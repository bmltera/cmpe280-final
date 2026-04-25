'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminLogin, getAdminJobs, updateAdminJob, runAdminScrape, runAdminSingleScrape } from '@/lib/api';
import { Job, ScrapeResult } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit modal
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [editForm, setEditForm] = useState<Partial<Job>>({});

  // Scrape
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [singleUrl, setSingleUrl] = useState('');
  const [scrapingSingle, setScrapingSingle] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const res = await adminLogin(password);
    if (res.success && res.data) {
      setAdminToken(res.data.token);
    } else {
      setLoginError(res.error || 'Invalid password');
    }
  };

  const fetchJobs = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    const res = await getAdminJobs(adminToken, page, search);
    if (res.success && res.data) {
      setJobs(res.data.jobs);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [adminToken, page, search]);

  useEffect(() => {
    if (adminToken) fetchJobs();
  }, [adminToken, fetchJobs]);

  const handleSaveJob = async () => {
    if (!editJob || !adminToken) return;
    const res = await updateAdminJob(editJob.id, editForm, adminToken);
    if (res.success) {
      toast.success('Job updated');
      setEditJob(null);
      fetchJobs();
    } else {
      toast.error('Failed to update job');
    }
  };

  const handleFullScrape = async () => {
    if (!adminToken) return;
    setScraping(true);
    setScrapeResult(null);
    const res = await runAdminScrape(adminToken);
    if (res.success && res.data) {
      setScrapeResult(res.data);
      toast.success(`Scrape complete: ${res.data.newJobs} new jobs`);
      fetchJobs();
    } else {
      toast.error('Scrape failed');
    }
    setScraping(false);
  };

  const handleSingleScrape = async () => {
    if (!adminToken || !singleUrl) return;
    setScrapingSingle(true);
    const res = await runAdminSingleScrape(singleUrl, adminToken);
    if (res.success && res.data) {
      toast.success(`Single scrape: ${res.data.newJobs} new, ${res.data.skipped} skipped`);
      setSingleUrl('');
      fetchJobs();
    } else {
      toast.error('Single scrape failed');
    }
    setScrapingSingle(false);
  };

  // Login Gate
  if (!adminToken) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Admin Access</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{loginError}</div>
              )}
              <Input
                type="password"
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full">Enter</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      {/* Scraper Controls */}
      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        <Card>
          <CardHeader><CardTitle className="text-base">Full Scrape</CardTitle></CardHeader>
          <CardContent>
            <Button onClick={handleFullScrape} disabled={scraping} className="w-full">
              {scraping ? 'Scraping...' : 'Run Full Scrape'}
            </Button>
            {scrapeResult && (
              <div className="mt-3 text-xs space-y-1">
                <p className="text-emerald-500">New: {scrapeResult.newJobs}</p>
                <p className="text-muted-foreground">Skipped: {scrapeResult.skipped}</p>
                <p className="text-destructive">Failed: {scrapeResult.failed}</p>
                <p className="text-muted-foreground/60">{scrapeResult.timestamp}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Single Job Scrape</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Paste job URL..."
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
              />
              <Button onClick={handleSingleScrape} disabled={scrapingSingle || !singleUrl}>
                {scrapingSingle ? '...' : 'Scrape'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Jobs List */}
      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <Badge variant="outline" className="shrink-0 px-4">{total} total</Badge>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-4 rounded-lg border border-border/40 bg-card/50 p-3 cursor-pointer hover:bg-card/80 transition-colors"
              onClick={() => { setEditJob(job); setEditForm(job); }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{job.title}</p>
                <p className="text-xs text-muted-foreground">{job.company} • {job.location}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">{job.source_name}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex gap-2 justify-center">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
        <span className="flex items-center text-sm text-muted-foreground">Page {page}</span>
        <Button size="sm" variant="outline" disabled={jobs.length < 50} onClick={() => setPage(p => p + 1)}>Next</Button>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editJob} onOpenChange={(open) => !open && setEditJob(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Job</DialogTitle></DialogHeader>
          {editJob && (
            <div className="space-y-3">
              {(['company', 'title', 'location', 'salary', 'job_type', 'application_url', 'source_name', 'source_url'] as (keyof Job)[]).map((field) => (
                <div key={field}>
                  <label className="text-xs font-medium capitalize">{field.replace(/_/g, ' ')}</label>
                  <Input
                    value={(editForm as any)[field] || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium">Description</label>
                <Textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
              </div>
              <Button className="w-full" onClick={handleSaveJob}>Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
