import { supabaseAdmin } from '../config/supabase';
import { Job, AdminJobUpdate } from '../types';
import crypto from 'crypto';

/**
 * Generate a unique hash for a job based on company, title, and application URL.
 */
export function generateJobHash(company: string, title: string, applicationUrl: string): string {
  const normalized = `${company.toLowerCase().trim()}|${title.toLowerCase().trim()}|${applicationUrl.trim()}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

export class JobRepository {
  /**
   * Get jobs for discovery, excluding dismissed and tracked jobs for a user.
   */
  async getDiscoverJobs(userId: string, limit: number = 20, salaryOnly: boolean = false): Promise<Job[]> {
    // Get user's dismissed job IDs
    const { data: dismissed } = await supabaseAdmin
      .from('user_dismissed_jobs')
      .select('job_id')
      .eq('user_id', userId);

    // Get user's tracked job IDs
    const { data: tracked } = await supabaseAdmin
      .from('user_tracked_jobs')
      .select('job_id')
      .eq('user_id', userId);

    const excludeIds = [
      ...(dismissed || []).map(d => d.job_id),
      ...(tracked || []).map(t => t.job_id),
    ];

    let query = supabaseAdmin
      .from('jobs')
      .select('*')
      .or('source_name.is.null,source_name.neq.gmail')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (salaryOnly) {
      query = query.not('salary', 'is', null);
    }

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching discover jobs:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get a single job by ID.
   */
  async getJobById(jobId: string): Promise<Job | null> {
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Insert a new job if it doesn't already exist (by unique_hash).
   */
  async insertJob(job: Omit<Job, 'id' | 'created_at' | 'updated_at'>): Promise<Job | null> {
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .upsert(job, { onConflict: 'unique_hash', ignoreDuplicates: true })
      .select()
      .single();

    if (error) {
      // Duplicate or conflict is expected
      if (error.code === 'PGRST116' || error.code === '23505') return null;
      console.error('Error inserting job:', error);
      return null;
    }

    return data;
  }

  /**
   * Check if a job hash already exists.
   */
  async jobHashExists(hash: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .eq('unique_hash', hash)
      .limit(1);

    return (data?.length || 0) > 0;
  }

  /**
   * Get total job count.
   */
  async getJobCount(): Promise<number> {
    const { count } = await supabaseAdmin
      .from('jobs')
      .select('*', { count: 'exact', head: true });

    return count || 0;
  }

  /**
   * Get all jobs with pagination and optional search (admin).
   */
  async getAllJobs(page: number = 1, limit: number = 50, search?: string, salaryOnly: boolean = false): Promise<{ jobs: Job[]; total: number }> {
    let query = supabaseAdmin
      .from('jobs')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`company.ilike.%${search}%,title.ilike.%${search}%,location.ilike.%${search}%`);
    }

    if (salaryOnly) {
      query = query.not('salary', 'is', null);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    return { jobs: data || [], total: count || 0 };
  }

  /**
   * Update a job (admin).
   */
  async updateJob(jobId: string, updates: AdminJobUpdate): Promise<Job | null> {
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete jobs with invalid company names (empty, "↳", or whitespace-only).
   * FK cascades handle related user_dismissed_jobs, user_tracked_jobs, user_apply_events.
   */
  async deleteJobsWithInvalidCompany(): Promise<number> {
    // Fetch IDs of bad jobs first
    const { data: badJobs } = await supabaseAdmin
      .from('jobs')
      .select('id, company')
      .or('company.is.null,company.eq.,company.eq.↳');

    if (!badJobs || badJobs.length === 0) return 0;

    // Also find whitespace-only companies
    const idsToDelete = badJobs
      .filter(j => !j.company || j.company.trim() === '' || j.company.trim() === '↳')
      .map(j => j.id);

    if (idsToDelete.length === 0) return 0;

    // Delete related records first (in case cascade isn't set up)
    for (const table of ['user_dismissed_jobs', 'user_tracked_jobs', 'user_apply_events'] as const) {
      await supabaseAdmin.from(table).delete().in('job_id', idsToDelete);
    }

    const { error } = await supabaseAdmin
      .from('jobs')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      console.error('Error deleting invalid company jobs:', error);
      return 0;
    }

    console.log(`[Cleanup] Deleted ${idsToDelete.length} jobs with invalid company names`);
    return idsToDelete.length;
  }

  /**
   * Update salary and/or location for a job identified by its unique_hash.
   */
  async updateJobByHash(hash: string, updates: { salary?: string | null; location?: string | null }): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('unique_hash', hash);

    if (error) {
      console.error('Error updating job by hash:', error);
      return false;
    }
    return true;
  }

  /**
   * Fix jobs with multiple locations (contain newlines) → set to "Multiple Locations".
   */
  async fixMultiLocationJobs(): Promise<number> {
    // Supabase doesn't support regex filtering easily, so fetch all jobs with location containing newlines
    const { data: allJobs } = await supabaseAdmin
      .from('jobs')
      .select('id, location')
      .not('location', 'is', null);

    if (!allJobs) return 0;

    const multiLocationJobs = allJobs.filter(j => {
      if (!j.location) return false;
      const lines = j.location.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      return lines.length > 1;
    });

    if (multiLocationJobs.length === 0) return 0;

    const ids = multiLocationJobs.map(j => j.id);

    const { error } = await supabaseAdmin
      .from('jobs')
      .update({ location: 'Multiple Locations', updated_at: new Date().toISOString() })
      .in('id', ids);

    if (error) {
      console.error('Error fixing multi-location jobs:', error);
      return 0;
    }

    console.log(`[Cleanup] Fixed ${ids.length} multi-location jobs`);
    return ids.length;
  }
}
