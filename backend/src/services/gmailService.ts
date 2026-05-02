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
          await supabaseAdmin.from('user_tokens').update({
            access_token: credentials.access_token,
            expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : data.expiry,
          }).eq('user_id', userId);
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
      '"next steps"'
    ];
    const query = keywords.join(' OR ');

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

    // Filter out obviously non-job emails
    if (bodyText.includes('newsletter') || bodyText.includes('marketing') || bodyText.includes('unsubscribe')) {
      return null;
    }

    // Attempt to extract Company
    let company = '';
    const fromMatch = from.match(/@([^.]+)\./);
    if (fromMatch && fromMatch[1]) {
      company = fromMatch[1].charAt(0).toUpperCase() + fromMatch[1].slice(1);
    }
    
    // Better company extraction from Subject (e.g. "Your application to Acme Corp")
    const companySubjectMatch = subject.match(/(?:at|to|with) ([A-Z][a-zA-Z0-9\s]+?)(?:for|role|-|$)/);
    if (companySubjectMatch && companySubjectMatch[1]) {
      company = companySubjectMatch[1].trim();
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

    // Determine status
    let status = 'applied';
    
    if (bodyText.includes('offer')) {
      status = 'offer';
    } else if (bodyText.includes('interview') || bodyText.includes('we\'d like to schedule') || bodyText.includes('schedule a time')) {
      status = 'interview_scheduled';
    } else if (bodyText.includes('unfortunately') || bodyText.includes('not moving forward') || bodyText.includes('other candidates')) {
      status = 'rejected';
    } else if (bodyText.includes('next steps') || bodyText.includes('moving forward')) {
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
