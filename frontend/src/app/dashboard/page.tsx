'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Job, JobCardState } from '@/types';
import { getDiscoverJobs, dismissJob, applyClicked, applyConfirmed } from '@/lib/api';
import { JobCard } from '@/components/jobs/JobCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const DISPLAY_COUNT = 8;

/** Keep the grid at `max` cards by filling from `pool` with jobs not already shown. */
function fillDisplaySlots(
  currentDisplay: Job[],
  removedJobId: string,
  pool: Job[],
  max: number
): Job[] {
  const filtered = currentDisplay.filter((j) => j.id !== removedJobId);
  const ids = new Set(filtered.map((j) => j.id));
  const out = [...filtered];
  for (const j of pool) {
    if (out.length >= max) break;
    if (!ids.has(j.id)) {
      out.push(j);
      ids.add(j.id);
    }
  }
  return out;
}

export default function DashboardPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [displayJobs, setDisplayJobs] = useState<Job[]>([]);
  const [cardStates, setCardStates] = useState<Record<string, JobCardState>>({});
  const [loading, setLoading] = useState(true);

  const jobsRef = useRef<Job[]>([]);
  const displayJobsRef = useRef<Job[]>([]);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  useEffect(() => {
    displayJobsRef.current = displayJobs;
  }, [displayJobs]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchJobs = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    setLoading(true);
    const res = await getDiscoverJobs(token);
    if (res.success && res.data) {
      setJobs(res.data);
      setDisplayJobs(res.data.slice(0, DISPLAY_COUNT));
      // Initialize states
      const states: Record<string, JobCardState> = {};
      res.data.forEach((j: Job) => { states[j.id] = 'default'; });
      setCardStates(states);
    }
    setLoading(false);
  }, [getToken]);

  // Key on user id, not `user` — token refresh on tab focus gives a new User object and would refetch/reset the grid.
  useEffect(() => {
    if (!userId) return;
    fetchJobs();
  }, [userId, fetchJobs]);

  const refillGridAfterJobRemoved = useCallback(
    async (removedJobId: string) => {
      const token = await getToken();
      if (!token) return;

      const res = await getDiscoverJobs(token);
      const freshPool = res.success && res.data ? res.data : null;
      if (freshPool) {
        setJobs(freshPool);
      }

      // Prefer fresh API list (excludes dismissed/tracked). On failure, drop removed id from stale pool so we never re-show that card.
      const poolRaw = freshPool ?? jobsRef.current;
      const pool = poolRaw.filter((j) => j.id !== removedJobId);

      const prev = displayJobsRef.current;
      const nextDisplay = fillDisplaySlots(prev, removedJobId, pool, DISPLAY_COUNT);

      setDisplayJobs(nextDisplay);
      setCardStates((prevStates) => {
        const next: Record<string, JobCardState> = {};
        for (const j of nextDisplay) {
          next[j.id] = prevStates[j.id] ?? 'default';
        }
        return next;
      });
    },
    [getToken]
  );

  const handleDismiss = async (jobId: string) => {
    // Start fade animation
    setCardStates(prev => ({ ...prev, [jobId]: 'fading_out' }));

    const token = await getToken();
    if (token) {
      await dismissJob(jobId, token);
    }

    setTimeout(() => {
      void refillGridAfterJobRemoved(jobId);
      toast.success('Job dismissed');
    }, 500);
  };

  const handleApply = async (jobId: string) => {
    const job = displayJobs.find(j => j.id === jobId);
    if (!job) return;

    // Open in new tab
    window.open(job.application_url, '_blank');

    // Record click
    const token = await getToken();
    if (token) {
      await applyClicked(jobId, token);
    }

    // Show confirmation
    setCardStates(prev => ({ ...prev, [jobId]: 'confirming' }));
  };

  const handleApplyConfirm = async (jobId: string) => {
    const token = await getToken();
    if (token) {
      const res = await applyConfirmed(jobId, token);
      if (res.success) {
        toast.success('Application tracked! Added to your Kanban board.');
        // Fade out and replace
        setCardStates(prev => ({ ...prev, [jobId]: 'fading_out' }));
        setTimeout(() => void refillGridAfterJobRemoved(jobId), 500);
      } else {
        toast.error('Failed to confirm application');
      }
    }
  };

  const handleApplyCancel = (jobId: string) => {
    setCardStates((prev) => {
      if (prev[jobId] === 'fading_out') return prev;
      return { ...prev, [jobId]: 'default' };
    });
  };

  if (authLoading || !user) {
    return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="mt-1 text-muted-foreground">Discover and apply to the latest positions</p>
      </div>

      {/* Job Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : displayJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/30 py-20">
          <p className="text-4xl mb-4">🎉</p>
          <h3 className="text-lg font-semibold">All caught up!</h3>
          <p className="mt-1 text-sm text-muted-foreground">No new jobs to discover right now. Check back later!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {displayJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              cardState={cardStates[job.id] || 'default'}
              onDismiss={handleDismiss}
              onApply={handleApply}
              onApplyConfirm={handleApplyConfirm}
              onApplyCancel={handleApplyCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
