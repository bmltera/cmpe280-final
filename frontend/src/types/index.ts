export interface Job {
  id: string;
  company: string;
  title: string;
  description: string | null;
  salary: string | null;
  location: string | null;
  job_type: string | null;
  application_url: string;
  source_name: string | null;
  source_url: string | null;
  scraped_at: string;
  created_at: string;
  updated_at: string;
}

export type KanbanStatus = 'Applied' | 'OA' | 'Interview' | 'Offer' | 'Rejected';

export interface TrackedJob {
  id: string;
  user_id: string;
  job_id: string;
  status: KanbanStatus;
  notes: string | null;
  applied_at: string | null;
  last_status_change_at: string;
  created_at: string;
  updated_at: string;
  job?: Job;
}

export type InterviewOutcome = 'pending' | 'passed' | 'failed' | 'cancelled';

export interface InterviewRound {
  id: string;
  tracked_job_id: string;
  user_id: string;
  round_name: string;
  scheduled_at: string | null;
  interviewer: string | null;
  notes: string | null;
  outcome: InterviewOutcome;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ScrapeResult {
  success: boolean;
  newJobs: number;
  skipped: number;
  failed: number;
  timestamp: string;
  errors?: string[];
}

// Job card states for the apply flow
export type JobCardState = 'default' | 'apply_started' | 'confirming' | 'fading_out';
