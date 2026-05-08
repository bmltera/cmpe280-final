import cron from 'node-cron';
import { ScraperService } from '../scrapers/jobScraper';
import { JobRepository } from '../repositories/jobRepository';

const scraperService = new ScraperService();
const jobRepo = new JobRepository();

/**
 * Initialize the cron scheduler.
 * Runs the job scraper every hour, then cleans up invalid data.
 */
export function initCronJobs(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log(`[Cron] Scheduled scrape starting at ${new Date().toISOString()}`);
    try {
      const result = await scraperService.runFullScrape();
      console.log(`[Cron] Scrape complete: ${result.newJobs} new, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`);

      // Run cleanup after scrape
      const deletedCompanies = await jobRepo.deleteJobsWithInvalidCompany();
      const fixedLocations = await jobRepo.fixMultiLocationJobs();
      console.log(`[Cron] Cleanup: ${deletedCompanies} invalid companies deleted, ${fixedLocations} multi-location jobs fixed`);
    } catch (err: any) {
      console.error('[Cron] Scrape error:', err.message);
    }
  });

  console.log('[Cron] Job scraper scheduled to run every hour');
}
