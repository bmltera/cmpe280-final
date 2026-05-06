import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase';

// Rejection is terminal and always wins; other statuses only progress forward.
const STATUS_PRIORITY: Record<string, number> = {
  applied: 0,
  in_review: 1,
  interview_scheduled: 2,
  offer: 3,
  rejected: 99,
};

function shouldUpdateStatus(current: string, incoming: string): boolean {
  if (incoming === 'rejected') return true;
  if (current === 'rejected') return false;
  return (STATUS_PRIORITY[incoming] ?? 0) > (STATUS_PRIORITY[current] ?? 0);
}

export class JobApplicationService {
  async processParsedEmail(userId: string, parsed: any) {
    // 1. Check if application already exists for this user, company, role, thread
    const { data: existingApps } = await supabaseAdmin
      .from('job_applications')
      .select('id, status')
      .eq('user_id', userId)
      .eq('gmail_thread_id', parsed.gmail_thread_id)
      .limit(1);

    const existingApp = existingApps && existingApps.length > 0 ? existingApps[0] : null;

    let applicationId = null;
    let isNew = false;
    let statusChanged = false;

    if (existingApp) {
      applicationId = existingApp.id;
      if (shouldUpdateStatus(existingApp.status, parsed.status)) {
        statusChanged = true;
        await supabaseAdmin
          .from('job_applications')
          .update({
            status: parsed.status,
            last_updated: parsed.date_applied,
            recruiter_name: parsed.recruiterName || null,
            recruiter_email: parsed.recruiterEmail || null,
          })
          .eq('id', applicationId);
      }
    } else {
      isNew = true;
      const { data: similarApps } = await supabaseAdmin
        .from('job_applications')
        .select('id, status')
        .eq('user_id', userId)
        .ilike('company', parsed.company)
        .ilike('role', parsed.role)
        .order('last_updated', { ascending: false })
        .limit(1);

      const similarApp = similarApps && similarApps.length > 0 ? similarApps[0] : null;

      if (similarApp) {
        applicationId = similarApp.id;
        if (shouldUpdateStatus(similarApp.status, parsed.status)) {
          statusChanged = true;
          await supabaseAdmin
            .from('job_applications')
            .update({
              status: parsed.status,
              last_updated: parsed.date_applied,
              gmail_thread_id: parsed.gmail_thread_id,
            })
            .eq('id', applicationId);
        }
      } else {
        // Insert new
        const { data: newApp, error } = await supabaseAdmin
          .from('job_applications')
          .insert({
            user_id: userId,
            company: parsed.company,
            role: parsed.role,
            status: parsed.status,
            date_applied: parsed.date_applied,
            last_updated: parsed.date_applied,
            recruiter_name: parsed.recruiterName,
            recruiter_email: parsed.recruiterEmail,
            gmail_thread_id: parsed.gmail_thread_id,
          })
          .select()
          .single();
          
        if (error) {
          console.error('Error inserting application', error);
          return;
        }
        if (newApp) {
          applicationId = newApp.id;
        }
      }
    }

    if (applicationId && (isNew || statusChanged)) {
      // Create event
      // check if event already exists to prevent duplicate event for the same email
      const { data: existingEvent } = await supabaseAdmin
        .from('application_events')
        .select('id')
        .eq('application_id', applicationId)
        .eq('status', parsed.status)
        .eq('event_date', parsed.date_applied)
        .single();
        
      if (!existingEvent) {
        await supabaseAdmin
          .from('application_events')
          .insert({
            application_id: applicationId,
            status: parsed.status,
            event_date: parsed.date_applied,
            email_snippet: parsed.snippet,
          });
      }
    }
  }

  async getApplications(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('job_applications')
      .select('*')
      .eq('user_id', userId)
      .order('last_updated', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateApplicationStatus(userId: string, id: string, status: string) {
    // Make sure user owns it
    const { data: app } = await supabaseAdmin
      .from('job_applications')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
      
    if (!app) throw new Error('Application not found');

    const { data, error } = await supabaseAdmin
      .from('job_applications')
      .update({ status, last_updated: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    // Add event
    await supabaseAdmin
      .from('application_events')
      .insert({
        application_id: id,
        status: status,
        event_date: new Date().toISOString(),
        email_snippet: 'Status updated manually',
      });

    return data;
  }

  async getApplicationTimeline(userId: string, id: string) {
    // Verify ownership
    const { data: app } = await supabaseAdmin
      .from('job_applications')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
      
    if (!app) throw new Error('Application not found');

    const { data, error } = await supabaseAdmin
      .from('application_events')
      .select('*')
      .eq('application_id', id)
      .order('event_date', { ascending: false });

    if (error) throw error;
    return data;
  }

  async addToKanban(userId: string, applicationId: string): Promise<string> {
    const { data: app, error: appError } = await supabaseAdmin
      .from('job_applications')
      .select('*')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .single();

    if (appError || !app) throw new Error('Application not found');

    const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${app.gmail_thread_id}`;
    const hash = crypto
      .createHash('md5')
      .update(`${app.company.toLowerCase().trim()}|${app.role.toLowerCase().trim()}|${gmailUrl.trim()}`)
      .digest('hex');

    // Find or create a synthetic jobs row for this Gmail application
    let jobId: string;
    const { data: existingJob } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .eq('unique_hash', hash)
      .maybeSingle();

    if (existingJob) {
      jobId = existingJob.id;
    } else {
      const { data: newJob, error: insertError } = await supabaseAdmin
        .from('jobs')
        .insert({
          company: app.company,
          title: app.role,
          application_url: gmailUrl,
          source_name: 'gmail',
          unique_hash: hash,
        })
        .select('id')
        .single();

      if (insertError || !newJob) throw new Error('Failed to create job entry');
      jobId = newJob.id;
    }

    const STATUS_MAP: Record<string, string> = {
      applied: 'Applied',
      in_review: 'Applied',
      interview_scheduled: 'Interview',
      offer: 'Offer',
      rejected: 'Rejected',
    };

    const { data: tracked, error: trackError } = await supabaseAdmin
      .from('user_tracked_jobs')
      .upsert(
        {
          user_id: userId,
          job_id: jobId,
          status: STATUS_MAP[app.status] ?? 'Applied',
          applied_at: app.date_applied,
          last_status_change_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,job_id' }
      )
      .select('id')
      .single();

    if (trackError || !tracked) throw new Error('Failed to track job');
    return tracked.id;
  }

  async deleteApplication(userId: string, id: string) {
    // Make sure user owns it
    const { data: app } = await supabaseAdmin
      .from('job_applications')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
      
    if (!app) throw new Error('Application not found');

    const { error } = await supabaseAdmin
      .from('job_applications')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
