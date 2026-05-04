'use client';

import { useState } from 'react';
import { Job, JobCardState } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';
import { splitLocationLines } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  onDismiss: (jobId: string) => void;
  onApply: (jobId: string) => void;
  onApplyConfirm: (jobId: string) => void;
  onApplyCancel: (jobId: string) => void;
  cardState: JobCardState;
}

export function JobCard({ job, onDismiss, onApply, onApplyConfirm, onApplyCancel, cardState }: JobCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const locationLines = splitLocationLines(job.location);

  const isFading = cardState === 'fading_out';

  return (
    <>
      <Card
        className={`group relative flex h-full flex-col overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-500 hover:border-border hover:shadow-lg hover:shadow-primary/5 ${
          isFading ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100'
        }`}
      >
        {/* Dismiss Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss(job.id);
          }}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-muted/80 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
          title="Dismiss"
        >
          ✕
        </button>

        <CardContent
          className="flex min-h-0 flex-1 cursor-pointer flex-col p-5"
          onClick={() => cardState === 'default' && setShowDetail(true)}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Title & Company */}
            <div className="flex items-start gap-3 pr-8">
              <CompanyLogo company={job.company} size={40} />
              <div className="min-w-0">
                <h3 className="text-base font-semibold leading-tight line-clamp-2">{job.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground truncate">{job.company}</p>
              </div>
            </div>

            {/* Description */}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-3">
              {job.description || 'Description unavailable — click to view details.'}
            </p>

            {/* Location & Salary */}
            <div className="mt-4 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-0.5 text-xs text-muted-foreground">
                {locationLines.length === 0 ? (
                  <span className="block">Location not listed</span>
                ) : (
                  locationLines.map((line, i) => (
                    <span key={`${i}-${line}`} className="block leading-snug line-clamp-2">
                      {line}
                    </span>
                  ))
                )}
              </div>
              <span className="shrink-0 text-right text-xs font-medium text-foreground">
                {job.salary || 'Salary not listed'}
              </span>
            </div>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.job_type && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0">
                  {job.job_type}
                </Badge>
              )}
              {job.source_name && (
                <Badge variant="outline" className="text-[10px] px-2 py-0">
                  {job.source_name}
                </Badge>
              )}
            </div>
          </div>

          {/* Apply — pinned to bottom of card */}
          <div className="mt-auto shrink-0 pt-4">
            {cardState === 'confirming' ? (
              <p className="text-center text-xs text-muted-foreground">
                Use the dialog to confirm whether you submitted an application.
              </p>
            ) : (
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onApply(job.id);
                }}
              >
                Apply
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Did you apply? — opens after Apply / Apply Now */}
      <Dialog
        open={cardState === 'confirming'}
        onOpenChange={(open) => {
          if (!open) onApplyCancel(job.id);
        }}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Did you apply?</DialogTitle>
            <DialogDescription>
              If you completed an application for this role, we&apos;ll add it to your Kanban board under
              Applied. Choose No if you still need to finish or haven&apos;t applied yet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onApplyCancel(job.id);
              }}
            >
              No, not yet
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                onApplyConfirm(job.id);
              }}
            >
              Yes, I applied
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <CompanyLogo company={job.company} size={56} />
              <div className="min-w-0">
                <DialogTitle className="text-xl leading-tight">{job.title}</DialogTitle>
                <DialogDescription className="mt-1">{job.company}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {locationLines.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {locationLines.map((line, i) => (
                    <Badge key={`${i}-${line}`} variant="secondary" className="w-fit text-left font-normal">
                      {line}
                    </Badge>
                  ))}
                </div>
              )}
              {job.job_type && <Badge variant="outline">{job.job_type}</Badge>}
            </div>
            {job.salary && (
              <div>
                <h4 className="text-sm font-medium mb-1">Salary</h4>
                <p className="text-sm text-muted-foreground">{job.salary}</p>
              </div>
            )}
            <div>
              <h4 className="text-sm font-medium mb-1">Description</h4>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {job.description || 'No detailed description available.'}
              </p>
            </div>
            {job.source_name && (
              <div>
                <h4 className="text-sm font-medium mb-1">Source</h4>
                <p className="text-sm text-muted-foreground">{job.source_name}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={(e) => {
                  e.preventDefault();
                  setShowDetail(false);
                  onApply(job.id);
                }}
              >
                Apply Now
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowDetail(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
