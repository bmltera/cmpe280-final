'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TrackedJob, KanbanStatus } from '@/types';
import { getTrackedJobs, updateTrackedJobStatus, updateTrackedJob } from '@/lib/api';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';
import { InterviewRoundsSection } from '@/components/jobs/InterviewRoundsSection';
import { splitLocationLines } from '@/lib/utils';

const COLUMNS: { id: KanbanStatus; label: string; color: string }[] = [
  { id: 'Applied', label: 'Applied', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  { id: 'OA', label: 'OA', color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
  { id: 'Interview', label: 'Interview', color: 'bg-purple-500/10 border-purple-500/20 text-purple-400' },
  { id: 'Offer', label: 'Offer', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  { id: 'Rejected', label: 'Rejected', color: 'bg-red-500/10 border-red-500/20 text-red-400' },
];

export default function KanbanPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<TrackedJob | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchJobs = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    const res = await getTrackedJobs(token);
    if (res.success && res.data) {
      setTrackedJobs(res.data);
    }
    setLoading(false);
  }, [getToken]);

  // Key on user id — session refresh on tab focus must not refetch and flash the board.
  useEffect(() => {
    if (!userId) return;
    fetchJobs();
  }, [userId, fetchJobs]);

  const getColumnJobs = (status: KanbanStatus) =>
    trackedJobs.filter((j) => j.status === status);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as KanbanStatus;
    const job = trackedJobs.find((j) => j.id === draggableId);
    if (!job || job.status === newStatus) return;

    // Optimistic update
    setTrackedJobs((prev) =>
      prev.map((j) => (j.id === draggableId ? { ...j, status: newStatus } : j))
    );

    const token = await getToken();
    if (token) {
      const res = await updateTrackedJobStatus(draggableId, newStatus, token);
      if (!res.success) {
        // Revert on failure
        setTrackedJobs((prev) =>
          prev.map((j) => (j.id === draggableId ? { ...j, status: job.status } : j))
        );
        toast.error('Failed to update status');
      } else {
        toast.success(`Moved to ${newStatus}`);
      }
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedJob) return;
    setSaving(true);
    const token = await getToken();
    if (token) {
      const res = await updateTrackedJob(selectedJob.id, { notes: editNotes }, token);
      if (res.success) {
        setTrackedJobs((prev) =>
          prev.map((j) => (j.id === selectedJob.id ? { ...j, notes: editNotes } : j))
        );
        toast.success('Notes saved');
        setSelectedJob(null);
      } else {
        toast.error('Failed to save notes');
      }
    }
    setSaving(false);
  };

  if (authLoading || !user) {
    return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-full px-2 py-6 sm:px-4 lg:px-6">
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Kanban Board</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">Track your application progress</p>
      </div>

      {loading ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-150 grid-cols-5 gap-1.5 sm:gap-2">
            {COLUMNS.map((c) => (
              <Skeleton key={c.id} className="h-80 min-h-0 min-w-0 rounded-lg sm:h-96" />
            ))}
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto">
            <div className="grid min-w-150 grid-cols-5 gap-1.5 sm:gap-2">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex min-w-0 flex-col">
                  <div
                    className={`mb-2 flex min-h-9 items-center gap-1 rounded-md border px-1.5 py-1 sm:mb-2.5 sm:gap-1.5 sm:px-2 sm:py-1.5 ${col.color}`}
                  >
                    <span className="min-w-0 truncate text-[11px] font-semibold leading-tight sm:text-xs">
                      {col.label}
                    </span>
                    <Badge variant="secondary" className="ml-auto shrink-0 px-1.5 py-0 text-[10px] sm:text-xs">
                      {getColumnJobs(col.id).length}
                    </Badge>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`max-h-[calc(100vh-11rem)] min-h-55 space-y-1.5 overflow-y-auto rounded-lg border border-dashed p-1 sm:min-h-65 sm:space-y-2 sm:p-1.5 ${
                          snapshot.isDraggingOver
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border/30 bg-card/20'
                        }`}
                      >
                      {getColumnJobs(col.id).map((tracked, index) => (
                        <Draggable key={tracked.id} draggableId={tracked.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`transition-shadow ${snapshot.isDragging ? 'shadow-xl' : ''}`}
                            >
                              <Card
                                className="cursor-pointer border-border/40 bg-card/80 hover:border-border hover:shadow-md"
                                onClick={() => {
                                  setSelectedJob(tracked);
                                  setEditNotes(tracked.notes || '');
                                }}
                              >
                                <CardContent className="p-2 sm:p-2.5">
                                  <div className="flex items-start gap-1.5 sm:gap-2">
                                    <CompanyLogo company={tracked.job?.company || 'Unknown'} size={24} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-semibold leading-snug line-clamp-2 sm:text-xs sm:line-clamp-1">
                                        {tracked.job?.title || 'Unknown'}
                                      </p>
                                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">
                                        {tracked.job?.company || 'Unknown'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-1 space-y-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                                    {splitLocationLines(tracked.job?.location).map((line, i) => (
                                      <p key={`${i}-${line}`} className="truncate leading-tight">
                                        {line}
                                      </p>
                                    ))}
                                  </div>
                                  {tracked.notes && (
                                    <p className="mt-1.5 line-clamp-2 text-[9px] italic text-muted-foreground sm:mt-2 sm:text-[10px]">
                                      {tracked.notes}
                                    </p>
                                  )}
                                  <p className="mt-1.5 truncate text-[9px] text-muted-foreground/60 sm:mt-2 sm:text-[10px]">
                                    Updated {new Date(tracked.last_status_change_at).toLocaleDateString()}
                                  </p>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Job Detail Modal */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedJob?.job?.title}</DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CompanyLogo company={selectedJob.job?.company || 'Unknown'} size={48} />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-muted-foreground">{selectedJob.job?.company}</p>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {splitLocationLines(selectedJob.job?.location).map((line, i) => (
                      <p key={`${i}-${line}`}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge>{selectedJob.status}</Badge>
                {selectedJob.job?.salary && <Badge variant="outline">{selectedJob.job.salary}</Badge>}
              </div>
              {selectedJob.job?.application_url && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(selectedJob.job?.application_url, '_blank')}
                >
                  Open Application Link
                </Button>
              )}
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  className="mt-1"
                  placeholder="Add notes about this application..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                />
              </div>
              <Button className="w-full" onClick={handleSaveNotes} disabled={saving}>
                {saving ? 'Saving...' : 'Save Notes'}
              </Button>
              <InterviewRoundsSection trackedJobId={selectedJob.id} getToken={getToken} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
