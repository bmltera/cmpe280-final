import cron from 'node-cron';
import { ScraperService } from '../scrapers/jobScraper';

const scraperService = new ScraperService();

/**
 * Initialize the cron scheduler.
 * Runs the job scraper every hour.
 */
export function initCronJobs(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log(`[Cron] Scheduled scrape starting at ${new Date().toISOString()}`);
    try {
      const result = await scraperService.runFullScrape();
      console.log(`[Cron] Scrape complete: ${result.newJobs} new, ${result.skipped} skipped, ${result.failed} failed`);
    } catch (err: any) {
      console.error('[Cron] Scrape error:', err.message);
    }
  });

  console.log('[Cron] Job scraper scheduled to run every hour');
}
