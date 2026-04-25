import { supabaseAdmin } from '../config/supabase';
import { TrackedJob, DismissedJob, ApplyEvent, KanbanStatus, ApplyEventType } from '../types';

export class UserRepository {
  /**
   * Ensure a user profile exists in the profiles table.
   */
  async ensureProfile(userId: string, email: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, email }, { onConflict: 'id' });

    if (error) {
      console.error('Error ensuring profile:', error);
    }
  }

  /**
   * Dismiss a job for a user.
   */
  async dismissJob(userId: string, jobId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('user_dismissed_jobs')
      .upsert({ user_id: userId, job_id: jobId }, { onConflict: 'user_id,job_id' });

    if (error) throw error;
  }

  /**
   * Record an apply event.
   */
  async recordApplyEvent(userId: string, jobId: string, eventType: ApplyEventType): Promise<void> {
    const { error } = await supabaseAdmin
      .from('user_apply_events')
      .insert({ user_id: userId, job_id: jobId, event_type: eventType });

    if (error) throw error;
  }

  /**
   * Create or update a tracked job (for apply confirmed).
   */
  async trackJob(userId: string, jobId: string, status: KanbanStatus = 'Applied'): Promise<TrackedJob> {
    const { data, error } = await supabaseAdmin
      .from('user_tracked_jobs')
      .upsert(
        {
          user_id: userId,
          job_id: jobId,
          status,
          applied_at: new Date().toISOString(),
          last_status_change_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,job_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get all tracked jobs for a user with job details.
   */
  async getTrackedJobs(userId: string): Promise<TrackedJob[]> {
    const { data, error } = await supabaseAdmin
      .from('user_tracked_jobs')
      .select(`
        *,
        job:jobs(*)
      `)
      .eq('user_id', userId)
      .order('last_status_change_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Update the status of a tracked job.
   */
  async updateTrackedJobStatus(trackedJobId: string, userId: string, status: KanbanStatus): Promise<TrackedJob | null> {
    const { data, error } = await supabaseAdmin
      .from('user_tracked_jobs')
      .update({
        status,
        last_status_change_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', trackedJobId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update notes for a tracked job.
   */
  async updateTrackedJobNotes(trackedJobId: string, userId: string, notes: string): Promise<TrackedJob | null> {
    const { data, error } = await supabaseAdmin
      .from('user_tracked_jobs')
      .update({
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trackedJobId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update both status and notes for a tracked job.
   */
  async updateTrackedJob(
    trackedJobId: string,
    userId: string,
    updates: { status?: KanbanStatus; notes?: string }
  ): Promise<TrackedJob | null> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (updates.status) {
      updateData.status = updates.status;
      updateData.last_status_change_at = new Date().toISOString();
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    const { data, error } = await supabaseAdmin
      .from('user_tracked_jobs')
      .update(updateData)
      .eq('id', trackedJobId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
