import { Router, Request, Response } from 'express';
import { adminMiddleware } from '../middleware/auth';
import { JobRepository } from '../repositories/jobRepository';
import { SettingsRepository } from '../repositories/settingsRepository';
import { ScraperService } from '../scrapers/jobScraper';

const router = Router();
const jobRepo = new JobRepository();
const settingsRepo = new SettingsRepository();
const scraperService = new ScraperService();

// POST /api/admin/login - Validate admin password
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    res.status(500).json({ success: false, error: 'Admin password not configured' });
    return;
  }

  if (password === adminPassword) {
    res.json({ success: true, data: { token: adminPassword } });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// GET /api/admin/jobs - Get all jobs (paginated, searchable)
router.get('/jobs', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const salaryOnly = req.query.salaryOnly === 'true';

    const result = await jobRepo.getAllJobs(page, limit, search, salaryOnly);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
  }
});

// PATCH /api/admin/jobs/:id - Update a job
router.patch('/jobs/:id', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { company, title, description, salary, location, job_type, application_url, source_name, source_url } = req.body;
    const updated = await jobRepo.updateJob(req.params.id as string, {
      company, title, description, salary, location, job_type, application_url, source_name, source_url,
    });

    if (!updated) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update job' });
  }
});

// POST /api/admin/scrape/run - Manually run full scrape
router.post('/scrape/run', adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('[Admin] Manual scrape triggered');
    const result = await scraperService.runFullScrape();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Scrape failed: ' + err.message });
  }
});

// POST /api/admin/scrape/single - Scrape a single job URL
router.post('/scrape/single', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { url, company, title } = req.body;
    if (!url) {
      res.status(400).json({ success: false, error: 'URL is required' });
      return;
    }

    const result = await scraperService.scrapeSingleJob(url, company, title);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Single scrape failed: ' + err.message });
  }
});

// POST /api/admin/cleanup - Run data cleanup (delete invalid companies, fix multi-locations)
router.post('/cleanup', adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('[Admin] Manual cleanup triggered');
    const deletedCompanies = await jobRepo.deleteJobsWithInvalidCompany();
    const fixedLocations = await jobRepo.fixMultiLocationJobs();

    res.json({
      success: true,
      data: {
        deletedInvalidCompanies: deletedCompanies,
        fixedMultiLocations: fixedLocations,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Cleanup failed: ' + err.message });
  }
});

// GET /api/admin/settings/salary-only - Get salary-only filter state
router.get('/settings/salary-only', adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const enabled = await settingsRepo.getSalaryOnly();
    res.json({ success: true, data: { enabled } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to get setting' });
  }
});

// PUT /api/admin/settings/salary-only - Set salary-only filter state
router.put('/settings/salary-only', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: '"enabled" boolean required' });
      return;
    }
    const success = await settingsRepo.setSalaryOnly(enabled);
    if (success) {
      console.log(`[Admin] Salary-only filter set to: ${enabled}`);
      res.json({ success: true, data: { enabled } });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save setting' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to save setting' });
  }
});

export default router;
