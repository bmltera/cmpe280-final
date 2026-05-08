// ========== Database Models ==========

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
  raw_source_text: string | null;
  scraped_at: string;
  created_at: string;
  updated_at: string;
  unique_hash: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
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
  // Joined fields
  job?: Job;
}

export interface DismissedJob {
  id: string;
  user_id: string;
  job_id: string;
  dismissed_at: string;
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

export type ApplyEventType = 'apply_clicked' | 'apply_confirmed' | 'apply_abandoned';

export interface ApplyEvent {
  id: string;
  user_id: string;
  job_id: string;
  event_type: ApplyEventType;
  created_at: string;
}

// ========== API Request/Response ==========

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ScrapeResult {
  success: boolean;
  newJobs: number;
  updated: number;
  skipped: number;
  failed: number;
  timestamp: string;
  errors?: string[];
}

export interface AdminJobUpdate {
  company?: string;
  title?: string;
  description?: string | null;
  salary?: string | null;
  location?: string | null;
  job_type?: string | null;
  application_url?: string;
  source_name?: string | null;
  source_url?: string | null;
}

// ========== Scraper Types ==========

export interface ScrapedJobRow {
  company: string;
  title: string;
  location: string;
  applicationUrl: string;
  datePosted: string;
  rawText: string;
  sourceName: string;
  sourceUrl: string;
}

export interface EnrichedJob extends ScrapedJobRow {
  description: string | null;
  salary: string | null;
  jobType: string | null;
}
