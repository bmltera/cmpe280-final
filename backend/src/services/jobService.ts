import { JobRepository } from '../repositories/jobRepository';
import { UserRepository } from '../repositories/userRepository';
import { Job, TrackedJob, KanbanStatus, ApplyEventType } from '../types';

const jobRepo = new JobRepository();
const userRepo = new UserRepository();

export class JobService {
  /**
   * Get jobs for the discovery page, excluding user's dismissed and tracked jobs.
   */
  async getDiscoverJobs(userId: string): Promise<Job[]> {
    // Ensure profile exists
    return jobRepo.getDiscoverJobs(userId, 20);
  }

  /**
   * Get a single job by ID.
   */
  async getJobById(jobId: string): Promise<Job | null> {
    return jobRepo.getJobById(jobId);
  }

  /**
   * Dismiss a job for a user.
   */
  async dismissJob(userId: string, jobId: string): Promise<void> {
    await userRepo.dismissJob(userId, jobId);
  }

  /**
   * Record that a user clicked the apply button.
   */
  async applyClicked(userId: string, jobId: string): Promise<void> {
    await userRepo.recordApplyEvent(userId, jobId, 'apply_clicked');
  }

  /**
   * Confirm that a user finished applying.
   * Creates a tracked job entry and records the event.
   */
  async applyConfirmed(userId: string, jobId: string): Promise<TrackedJob> {
    await userRepo.recordApplyEvent(userId, jobId, 'apply_confirmed');
    return userRepo.trackJob(userId, jobId, 'Applied');
  }

  /**
   * Get all tracked jobs for a user.
   */
  async getTrackedJobs(userId: string): Promise<TrackedJob[]> {
    return userRepo.getTrackedJobs(userId);
  }

  /**
   * Update the status of a tracked job.
   */
  async updateTrackedJobStatus(trackedJobId: string, userId: string, status: KanbanStatus): Promise<TrackedJob | null> {
    return userRepo.updateTrackedJobStatus(trackedJobId, userId, status);
  }

  /**
   * Update notes for a tracked job.
   */
  async updateTrackedJobNotes(trackedJobId: string, userId: string, notes: string): Promise<TrackedJob | null> {
    return userRepo.updateTrackedJobNotes(trackedJobId, userId, notes);
  }

  /**
   * Update both status and notes for a tracked job.
   */
  async updateTrackedJob(
    trackedJobId: string,
    userId: string,
    updates: { status?: KanbanStatus; notes?: string }
  ): Promise<TrackedJob | null> {
    return userRepo.updateTrackedJob(trackedJobId, userId, updates);
  }
}
