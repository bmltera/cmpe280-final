'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { buttonVariants } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function Home() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      redirect('/dashboard');
    }
  }, [user, loading]);

  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative px-4 pt-20 pb-32 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-purple-500/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            Auto-scraping new jobs every hour
          </div>

          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Your Job Search,
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Organized & Automated
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Discover new-grad and internship positions auto-scraped from top job boards.
            Apply with one click, track your progress on a Kanban board, and never lose track of an application again.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }), 'h-12 px-8 text-base')}>
              Start Tracking Jobs
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 px-8 text-base')}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: '🔍',
                title: 'Auto-Discovery',
                desc: 'Jobs scraped automatically from curated GitHub lists every hour. Never miss a new posting.',
              },
              {
                icon: '📋',
                title: 'Kanban Tracking',
                desc: 'Drag and drop jobs between Applied, OA, Interview, Offer, and Rejected columns.',
              },
              {
                icon: '⚡',
                title: 'One-Click Apply',
                desc: 'Click apply, confirm when done, and the job instantly appears in your tracker.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur-sm transition-all hover:border-border hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 text-4xl">{f.icon}</div>
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
