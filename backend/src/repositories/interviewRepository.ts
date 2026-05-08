import { supabaseAdmin } from '../config/supabase';
import { InterviewOutcome, InterviewRound } from '../types';

export interface InterviewRoundCreate {
  tracked_job_id: string;
  round_name: string;
  scheduled_at?: string | null;
  interviewer?: string | null;
  notes?: string | null;
  outcome?: InterviewOutcome;
}

export interface InterviewRoundUpdate {
  round_name?: string;
  scheduled_at?: string | null;
  interviewer?: string | null;
  notes?: string | null;
  outcome?: InterviewOutcome;
}

export class InterviewRepository {
  async listForTrackedJob(userId: string, trackedJobId: string): Promise<InterviewRound[]> {
    const { data, error } = await supabaseAdmin
      .from('interview_rounds')
      .select('*')
      .eq('user_id', userId)
      .eq('tracked_job_id', trackedJobId)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /** Verifies the tracked job belongs to the user before inserting. */
  async create(userId: string, input: InterviewRoundCreate): Promise<InterviewRound> {
    const { data: tracked, error: lookupErr } = await supabaseAdmin
      .from('user_tracked_jobs')
      .select('id')
      .eq('id', input.tracked_job_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (lookupErr) throw lookupErr;
    if (!tracked) throw new Error('Tracked job not found');

    const { data, error } = await supabaseAdmin
      .from('interview_rounds')
      .insert({
        user_id: userId,
        tracked_job_id: input.tracked_job_id,
        round_name: input.round_name,
        scheduled_at: input.scheduled_at ?? null,
        interviewer: input.interviewer ?? null,
        notes: input.notes ?? null,
        outcome: input.outcome ?? 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(userId: string, roundId: string, updates: InterviewRoundUpdate): Promise<InterviewRound | null> {
    const { data, error } = await supabaseAdmin
      .from('interview_rounds')
      .update(updates)
      .eq('id', roundId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async delete(userId: string, roundId: string): Promise<boolean> {
    const { error, count } = await supabaseAdmin
      .from('interview_rounds')
      .delete({ count: 'exact' })
      .eq('id', roundId)
      .eq('user_id', userId);

    if (error) throw error;
    return (count ?? 0) > 0;
  }
}
