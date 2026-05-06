import { google } from 'googleapis';
import { supabaseAdmin } from '../config/supabase';
import { JobApplicationService } from './jobApplicationService';

export class GmailService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/gmail/callback'
    );
  }

  getAuthUrl(userId: string) {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      state: userId,
    });
  }

  async handleCallback(code: string, userId: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    
    // Calculate expiry based on tokens.expiry_date
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

    await supabaseAdmin.from('user_tokens').upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry: expiry,
    }, { onConflict: 'user_id' });
  }

  async syncEmails(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('user_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('Gmail not connected');
    }

    this.oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry_date: data.expiry ? new Date(data.expiry).getTime() : null,
    });

    // Check if token needs refresh
    if (data.expiry && new Date(data.expiry).getTime() < Date.now() + 5 * 60000) {
      if (data.refresh_token) {
        try {
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          const updateData: any = {
            access_token: credentials.access_token,
            expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : data.expiry,
          };
          if (credentials.refresh_token) {
            updateData.refresh_token = credentials.refresh_token;
          }
          await supabaseAdmin.from('user_tokens').update(updateData).eq('user_id', userId);
        } catch (e) {
          console.error('Failed to refresh token', e);
          throw new Error('Failed to refresh Gmail token. Please reconnect.');
        }
      }
    }

    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    // Fetch user's tracked senders
    const { data: trackedSenders } = await supabaseAdmin
      .from('user_tracked_senders')
      .select('email')
      .eq('user_id', userId);
    const senderEmails = (trackedSenders || []).map((s: any) => s.email as string);

    // Only search Primary and Updates inbox tabs
    const categoryFilter = '(category:primary OR category:updates)';

    const keywords = [
      '"application received"',
      '"thank you for applying"',
      '"we\'d like to schedule"',
      '"interview"',
      '"unfortunately"',
      '"offer"',
      '"next steps"',
      '"confirmation of application"',
    ];
    const excludeTerms = [
      'newsletter', 'marketing', 'digest', 'summary', 'unsubscribe',
      'weekly', 'daily',
      '"new jobs for you"', '"jobs you might like"', '"job alert"',
      '"recommended jobs"', '"view more jobs"', '"latest job openings"',
    ];

    const standardQuery = `${categoryFilter} (${keywords.join(' OR ')}) -{${excludeTerms.join(' ')}}`;

    const standardRes = await gmail.users.messages.list({
      userId: 'me',
      q: standardQuery,
      maxResults: 50,
    });

    // Collect standard message IDs
    const standardIds = new Set<string>(
      (standardRes.data.messages || []).map((m: any) => m.id as string).filter(Boolean)
    );

    // Collect tracked-sender message IDs (no keyword filter — user opted in explicitly)
    const trackedIds = new Set<string>();
    if (senderEmails.length > 0) {
      const fromClause = senderEmails.map(e => `from:${e}`).join(' OR ');
      const trackedRes = await gmail.users.messages.list({
        userId: 'me',
        q: `${categoryFilter} (${fromClause})`,
        maxResults: 50,
      });
      for (const m of trackedRes.data.messages || []) {
        if (m.id && !standardIds.has(m.id)) {
          trackedIds.add(m.id);
        }
      }
    }

    const jobAppService = new JobApplicationService();
    let syncedCount = 0;

    const toProcess = [
      ...[...standardIds].map(id => ({ id, skipFilters: false })),
      ...[...trackedIds].map(id => ({ id, skipFilters: true })),
    ];

    for (const { id, skipFilters } of toProcess) {
      try {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'full',
        });

        const parsed = this.parseEmail(email.data, skipFilters);
        if (parsed) {
          await jobAppService.processParsedEmail(userId, parsed);
          syncedCount++;
        }
      } catch (e) {
        console.error(`Failed to process message ${id}:`, e);
      }
    }

    return syncedCount;
  }

  private extractBodyText(payload: any): string {
    if (!payload) return '';

    if (payload.body?.data) {
      const mimeType = payload.mimeType || '';
      if (mimeType === 'text/plain' || mimeType === 'text/html') {
        const raw = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
        const text = Buffer.from(raw, 'base64').toString('utf-8');
        if (mimeType === 'text/html') {
          return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        return text;
      }
    }

    if (payload.parts) {
      const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (plainPart) return this.extractBodyText(plainPart);

      const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
      if (htmlPart) return this.extractBodyText(htmlPart);

      for (const part of payload.parts) {
        const text = this.extractBodyText(part);
        if (text) return text;
      }
    }

    return '';
  }

  private parseEmail(emailData: any, skipFilters = false) {
    const headers = emailData.payload?.headers || [];
    const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
    const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
    const dateStr = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value;
    const date = dateStr ? new Date(dateStr) : new Date();

    const snippet = emailData.snippet || '';
    const fullBody = this.extractBodyText(emailData.payload).slice(0, 8000);

    // Advanced parsing strategy: regex and keyword matching
    const subjectLower = subject.toLowerCase();
    // Use full body for matching when available, fall back to snippet
    const bodyContent = fullBody || snippet;
    const bodyText = (subjectLower + " " + bodyContent.toLowerCase());

    // 1. Filter out obviously non-job emails (Marketing, Newsletters, Digests)
    const negativeKeywords = [
      'newsletter', 'marketing', 'unsubscribe', 'digest', 'summary', 
      'weekly', 'daily', 'notification', 'alert', 'recommended', 
      'new jobs', 'latest openings', 'matches your search', 'sponsored',
      'advertisement', 'privacy policy', 'terms of service', 'feedback',
      'survey', 'webinar', 'event', 'promotion'
    ];

    if (!skipFilters) {
      if (negativeKeywords.some(kw => bodyText.includes(kw))) {
        return null;
      }

      // 2. Check for List-Unsubscribe header (strong indicator of a newsletter)
      if (headers.some((h: any) => h.name.toLowerCase() === 'list-unsubscribe')) {
        return null;
      }

      // 3. Ensure the email is actually about a specific job application
      const applicationKeywords = [
        'applied', 'application', 'interview', 'schedule', 'unfortunately',
        'offer', 'moving forward', 'next steps', 'hiring',
      ];

      if (!applicationKeywords.some(kw => bodyText.includes(kw))) {
        return null;
      }
    }

    // Attempt to extract Company
    let company = '';
    
    // Better company extraction from Subject (e.g. "Your application to Acme Corp")
    const companySubjectMatch = subject.match(/(?:at|to|with) ([A-Z][a-zA-Z0-9\s\.]+?)(?:\sfor|\srole|\s-|$)|\s([A-Z][a-zA-Z0-9\.]+)$/);
    if (companySubjectMatch) {
      company = (companySubjectMatch[1] || companySubjectMatch[2]).trim();
    }
    
    if (!company) {
      const fromMatch = from.match(/@([^.]+)\./);
      if (fromMatch && fromMatch[1]) {
        const domain = fromMatch[1].toLowerCase();
        // Skip common job board/platform domains
        const platforms = ['greenhouse', 'lever', 'workday', 'smartrecruiters', 'ashbyhq', 'breezy', 'jobvite'];
        if (!platforms.includes(domain)) {
          company = fromMatch[1].charAt(0).toUpperCase() + fromMatch[1].slice(1);
        }
      }
    }
    
    if (!company) {
      company = 'Unknown Company'; // Fallback
    }

    // Attempt to extract Role
    let role = 'Software Engineer'; // Default generic fallback
    const roleMatch = subject.match(/(?:for|role)\s+([^-\(]+)/i);
    if (roleMatch && roleMatch[1]) {
      role = roleMatch[1].trim();
    } else {
      // Just take the first part of the subject
      role = subject.split(/[-|:()]/)[0].trim() || 'Software Engineer';
    }

    // Determine status - Order matters (check rejection first)
    let status = 'applied';

    const isRejection = [
      'unfortunately', 'not moving forward', 'decided to proceed with other',
      'decided not to move forward', 'position has been filled', 'no longer considering',
      'not selected', "we won't be moving", 'we have decided to move forward with other',
      'not a fit', 'not moving ahead',
    ].some(p => bodyText.includes(p));

    const isOffer = [
      'pleased to offer', 'extend an offer', 'compensation package',
      'start date', 'offer letter', 'we are offering',
    ].some(p => bodyText.includes(p)) || (bodyText.includes('offer') && !isRejection);

    const isInterview = [
      'schedule an interview', "we'd like to schedule", 'schedule a time',
      'availability', 'virtual meeting', 'google meet', 'zoom', 'calendly',
      'phone screen', 'video call', 'technical interview', 'hiring manager',
      'interview invite', 'interview request',
    ].some(p => bodyText.includes(p)) || (bodyText.includes('interview') && !isRejection);

    if (isRejection) {
      status = 'rejected';
    } else if (isOffer) {
      status = 'offer';
    } else if (isInterview) {
      status = 'interview_scheduled';
    } else if (bodyText.includes('moving forward') || bodyText.includes('next steps')) {
      status = 'in_review';
    } else if (bodyText.includes('application received') || bodyText.includes('thank you for applying')) {
      status = 'applied';
    }

    let recruiterName = null;
    let recruiterEmail = null;
    
    // Extract recruiter info from 'From' header format "Name <email>"
    const fromEmailMatch = from.match(/(.*)<(.*)>/);
    if (fromEmailMatch) {
      recruiterName = fromEmailMatch[1].replace(/"/g, '').trim();
      recruiterEmail = fromEmailMatch[2].trim();
    } else {
      recruiterEmail = from.trim();
    }

    return {
      company,
      role,
      status,
      date_applied: date,
      gmail_thread_id: emailData.threadId,
      recruiterName,
      recruiterEmail,
      snippet: snippet,
    };
  }
}
