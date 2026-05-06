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
  async getDiscoverJobs(userId: string, limit: number = 20): Promise<Job[]> {
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
  async getAllJobs(page: number = 1, limit: number = 50, search?: string): Promise<{ jobs: Job[]; total: number }> {
    let query = supabaseAdmin
      .from('jobs')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`company.ilike.%${search}%,title.ilike.%${search}%,location.ilike.%${search}%`);
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
}
