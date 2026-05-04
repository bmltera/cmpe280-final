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

    // Build search query based on keywords
    const keywords = [
      '"application received"',
      '"thank you for applying"',
      '"we\'d like to schedule"',
      '"interview"',
      '"unfortunately"',
      '"offer"',
      '"next steps"',
      '"confirmation of application"'
    ];
    // Exclude common newsletter/marketing terms from the search itself
    const excludeTerms = [
      'newsletter',
      'marketing',
      'digest',
      'summary',
      'unsubscribe',
      'weekly',
      'daily',
      '"new jobs for you"',
      '"jobs you might like"',
      '"job alert"',
      '"recommended jobs"',
      '"view more jobs"',
      '"latest job openings"'
    ];
    
    const query = `(${keywords.join(' OR ')}) -{${excludeTerms.join(' ')}}`;

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50, // Fetch recent emails
    });

    const messages = res.data.messages || [];
    const jobAppService = new JobApplicationService();
    
    let syncedCount = 0;

    for (const msg of messages) {
      if (!msg.id) continue;
      
      try {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });
        
        const parsed = this.parseEmail(email.data);
        if (parsed) {
          await jobAppService.processParsedEmail(userId, parsed);
          syncedCount++;
        }
      } catch (e) {
        console.error(`Failed to process message ${msg.id}:`, e);
        // Continue to next message instead of crashing the whole sync
      }
    }
    
    return syncedCount;
  }

  private parseEmail(emailData: any) {
    const headers = emailData.payload?.headers || [];
    const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
    const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
    const dateStr = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value;
    const date = dateStr ? new Date(dateStr) : new Date();
    
    let snippet = emailData.snippet || '';

    // Advanced parsing strategy: regex and keyword matching
    const subjectLower = subject.toLowerCase();
    const snippetLower = snippet.toLowerCase();
    const bodyText = (subjectLower + " " + snippetLower);

    // 1. Filter out obviously non-job emails (Marketing, Newsletters, Digests)
    const negativeKeywords = [
      'newsletter', 'marketing', 'unsubscribe', 'digest', 'summary', 
      'weekly', 'daily', 'notification', 'alert', 'recommended', 
      'new jobs', 'latest openings', 'matches your search', 'sponsored',
      'advertisement', 'privacy policy', 'terms of service', 'feedback',
      'survey', 'webinar', 'event', 'promotion'
    ];

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
      'offer', 'moving forward', 'next steps', 'hiring'
    ];
    
    if (!applicationKeywords.some(kw => bodyText.includes(kw))) {
      return null;
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
    
    if (bodyText.includes('unfortunately') || bodyText.includes('not moving forward') || bodyText.includes('decided to proceed with other')) {
      status = 'rejected';
    } else if (bodyText.includes('offer')) {
      status = 'offer';
    } else if (bodyText.includes('interview') || bodyText.includes('we\'d like to schedule') || bodyText.includes('schedule a time')) {
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
