import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedJobRow, EnrichedJob } from '../types';
import { JobRepository, generateJobHash } from '../repositories/jobRepository';
import { ScrapeResult } from '../types';

const SOURCES = [
  {
    name: 'New Grad 2027',
    url: 'https://raw.githubusercontent.com/vanshb03/New-Grad-2027/dev/README.md',
    pageUrl: 'https://github.com/vanshb03/New-Grad-2027/blob/dev/README.md',
    jobType: 'Full-time',
  },
  {
    name: 'Summer 2027 Internships',
    url: 'https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/README.md',
    pageUrl: 'https://github.com/vanshb03/Summer2027-Internships/blob/dev/README.md',
    jobType: 'Internship',
  },
];

/**
 * Parse the markdown table from the GitHub README to extract job rows.
 * The table format is:
 * | Company | Role | Location | Application/Link | Date Posted |
 */
function parseReadmeTable(markdown: string, sourceName: string, sourceUrl: string, jobType: string): ScrapedJobRow[] {
  const jobs: ScrapedJobRow[] = [];
  const lines = markdown.split('\n');

  let inTable = false;
  let headerFound = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect the table header
    if (trimmed.startsWith('| Company') || trimmed.startsWith('| **Company')) {
      inTable = true;
      headerFound = false;
      continue;
    }

    // Skip the separator line (| --- | --- | ...)
    if (inTable && !headerFound && trimmed.match(/^\|[\s-:]+\|/)) {
      headerFound = true;
      continue;
    }

    // Parse table rows
    if (inTable && headerFound && trimmed.startsWith('|')) {
      try {
        const row = parseTableRow(trimmed, sourceName, sourceUrl, jobType);
        if (row) {
          jobs.push(row);
        }
      } catch (e) {
        // Skip malformed rows
        continue;
      }
    }

    // End of table
    if (inTable && headerFound && !trimmed.startsWith('|') && trimmed.length > 0) {
      // Could be end of table, but there might be multiple tables
      // Reset for next potential table
      inTable = false;
      headerFound = false;
    }
  }

  return jobs;
}

/**
 * Parse a single table row from the markdown.
 */
function parseTableRow(line: string, sourceName: string, sourceUrl: string, jobType: string): ScrapedJobRow | null {
  // Split by | and clean up
  const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);

  if (cells.length < 4) return null;

  const companyRaw = cells[0];
  const titleRaw = cells[1];
  const locationRaw = cells[2];
  const linkRaw = cells[3];
  const datePosted = cells[4] || '';

  // Clean company name (remove ** bold markers)
  const company = companyRaw.replace(/\*\*/g, '').trim();

  // Clean title (remove emoji flags and 🛂 🔒 markers)
  const title = titleRaw.replace(/🛂|🔒|🇺🇸|🇨🇦/g, '').trim();

  // Clean location: line breaks from <br>, </br>, etc. → newline; store one line per site
  const location = locationRaw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/\s*br\s*>/gi, '\n')
    .replace(/<\/?details>/gi, '')
    .replace(/<\/?summary>/gi, '')
    .replace(/\*\*/g, '')
    .split(/\n+/)
    .map((s) => s.replace(/^\s*,\s*/, '').trim())
    .filter((s) => s.length > 0)
    .join('\n');

  // Extract application URL from the HTML anchor tag
  const urlMatch = linkRaw.match(/href="([^"]+)"/);
  if (!urlMatch) return null;

  let applicationUrl = urlMatch[1];

  // Remove utm_source parameter
  applicationUrl = applicationUrl.replace(/[?&]utm_source=vansh/, '').replace(/[?&]ref=vansh/, '');
  // Clean trailing ? or &
  applicationUrl = applicationUrl.replace(/[?&]$/, '');

  // Skip if it's a closed job (has 🔒)
  if (titleRaw.includes('🔒')) return null;

  if (!company || !title || !applicationUrl) return null;

  return {
    company,
    title,
    location,
    applicationUrl,
    datePosted: datePosted.trim(),
    rawText: line,
    sourceName,
    sourceUrl,
  };
}

/**
 * Attempt to enrich a job by scraping the application URL for additional data.
 * This is best-effort and will timeout/fail gracefully.
 */
async function enrichJob(job: ScrapedJobRow): Promise<EnrichedJob> {
  const enriched: EnrichedJob = {
    ...job,
    description: null,
    salary: null,
    jobType: null,
  };

  try {
    const response = await axios.get(job.applicationUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 400,
    });

    if (typeof response.data === 'string') {
      const $ = cheerio.load(response.data);

      // Try to extract description from common job page patterns
      const descSelectors = [
        '[data-testid="job-description"]',
        '.job-description',
        '.description',
        '#job-description',
        '[class*="description"]',
        'article',
        '.posting-requirements',
        '.content-wrapper',
      ];

      for (const selector of descSelectors) {
        const el = $(selector).first();
        if (el.length) {
          const text = el.text().trim().substring(0, 2000);
          if (text.length > 50) {
            enriched.description = text;
            break;
          }
        }
      }

      // Try to extract salary
      const pageText = $('body').text();
      const salaryMatch = pageText.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\s*(?:per|\/)\s*(?:year|hr|hour|annum))?/i);
      if (salaryMatch) {
        enriched.salary = salaryMatch[0].trim();
      }
    }
  } catch (err) {
    // Enrichment is best-effort, don't fail the job
    // console.log(`Could not enrich job: ${job.company} - ${job.title}`);
  }

  return enriched;
}

/**
 * Main scraper service.
 */
export class ScraperService {
  private jobRepo: JobRepository;

  constructor() {
    this.jobRepo = new JobRepository();
  }

  /**
   * Run a full scrape of all sources.
   */
  async runFullScrape(): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: true,
      newJobs: 0,
      skipped: 0,
      failed: 0,
      timestamp: new Date().toISOString(),
      errors: [],
    };

    const currentJobCount = await this.jobRepo.getJobCount();
    const isFirstScrape = currentJobCount === 0;
    const maxJobs = isFirstScrape ? 30 : 100; // Limit first scrape

    console.log(`[Scraper] Starting scrape. Current jobs: ${currentJobCount}. First scrape: ${isFirstScrape}`);

    for (const source of SOURCES) {
      try {
        console.log(`[Scraper] Fetching: ${source.name}`);
        const response = await axios.get(source.url, { timeout: 15000 });
        const markdown = response.data;

        const rows = parseReadmeTable(markdown, source.name, source.pageUrl, source.jobType);
        console.log(`[Scraper] Parsed ${rows.length} rows from ${source.name}`);

        // Take most recent rows (they appear at the top)
        const candidates = isFirstScrape ? rows.slice(0, Math.ceil(maxJobs / SOURCES.length)) : rows;

        for (const row of candidates) {
          if (result.newJobs >= maxJobs) break;

          try {
            const hash = generateJobHash(row.company, row.title, row.applicationUrl);

            // Check if already exists
            const exists = await this.jobRepo.jobHashExists(hash);
            if (exists) {
              result.skipped++;
              continue;
            }

            // Enrich job (best effort)
            const enriched = await enrichJob(row);

            // Insert into database
            const inserted = await this.jobRepo.insertJob({
              company: enriched.company,
              title: enriched.title,
              description: enriched.description,
              salary: enriched.salary,
              location: enriched.location,
              job_type: enriched.jobType || source.jobType,
              application_url: enriched.applicationUrl,
              source_name: enriched.sourceName,
              source_url: enriched.sourceUrl,
              raw_source_text: enriched.rawText,
              scraped_at: new Date().toISOString(),
              unique_hash: hash,
            });

            if (inserted) {
              result.newJobs++;
              console.log(`[Scraper] New job: ${enriched.company} - ${enriched.title}`);
            } else {
              result.skipped++;
            }
          } catch (err: any) {
            result.failed++;
            result.errors?.push(`Failed: ${row.company} - ${row.title}: ${err.message}`);
          }
        }
      } catch (err: any) {
        console.error(`[Scraper] Error scraping ${source.name}:`, err.message);
        result.errors?.push(`Source error: ${source.name}: ${err.message}`);
      }
    }

    console.log(`[Scraper] Complete. New: ${result.newJobs}, Skipped: ${result.skipped}, Failed: ${result.failed}`);
    return result;
  }

  /**
   * Scrape a single job URL.
   */
  async scrapeSingleJob(applicationUrl: string, company?: string, title?: string): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      newJobs: 0,
      skipped: 0,
      failed: 0,
      timestamp: new Date().toISOString(),
      errors: [],
    };

    try {
      const jobRow: ScrapedJobRow = {
        company: company || 'Unknown',
        title: title || 'Unknown Position',
        location: '',
        applicationUrl,
        datePosted: new Date().toLocaleDateString(),
        rawText: `Manual scrape: ${applicationUrl}`,
        sourceName: 'Manual',
        sourceUrl: applicationUrl,
      };

      const hash = generateJobHash(jobRow.company, jobRow.title, jobRow.applicationUrl);
      const exists = await this.jobRepo.jobHashExists(hash);

      if (exists) {
        result.skipped = 1;
        result.success = true;
        return result;
      }

      const enriched = await enrichJob(jobRow);

      // Try to extract company/title from the page if not provided
      if (!company || !title) {
        try {
          const resp = await axios.get(applicationUrl, { timeout: 8000 });
          if (typeof resp.data === 'string') {
            const $ = cheerio.load(resp.data);
            if (!company) enriched.company = $('title').text().split('|')[0]?.trim() || 'Unknown';
            if (!title) enriched.title = $('h1').first().text().trim() || 'Unknown Position';
          }
        } catch {}
      }

      const inserted = await this.jobRepo.insertJob({
        company: enriched.company,
        title: enriched.title,
        description: enriched.description,
        salary: enriched.salary,
        location: enriched.location || '',
        job_type: enriched.jobType,
        application_url: enriched.applicationUrl,
        source_name: 'Manual',
        source_url: applicationUrl,
        raw_source_text: enriched.rawText,
        scraped_at: new Date().toISOString(),
        unique_hash: hash,
      });

      if (inserted) {
        result.newJobs = 1;
        result.success = true;
      } else {
        result.skipped = 1;
        result.success = true;
      }
    } catch (err: any) {
      result.failed = 1;
      result.errors?.push(err.message);
    }

    return result;
  }
}
