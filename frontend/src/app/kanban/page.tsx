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
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Kanban Board</h1>
        <p className="mt-1 text-muted-foreground">Track your application progress</p>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((c) => (
            <Skeleton key={c.id} className="h-96 w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => (
              <div key={col.id} className="w-72 shrink-0">
                <div className={`mb-3 flex items-center gap-2 rounded-lg border p-2.5 ${col.color}`}>
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {getColumnJobs(col.id).length}
                  </Badge>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[400px] space-y-2 rounded-xl border border-dashed p-2 transition-colors ${
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
                                <CardContent className="p-3.5">
                                  <div className="flex items-start gap-2.5">
                                    <CompanyLogo company={tracked.job?.company || 'Unknown'} size={28} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold line-clamp-1">{tracked.job?.title || 'Unknown'}</p>
                                      <p className="mt-0.5 text-xs text-muted-foreground truncate">{tracked.job?.company || 'Unknown'}</p>
                                    </div>
                                  </div>
                                  <p className="mt-1 text-[10px] text-muted-foreground truncate">
                                    {tracked.job?.location || ''}
                                  </p>
                                  {tracked.notes && (
                                    <p className="mt-2 text-[10px] text-muted-foreground line-clamp-2 italic">
                                      {tracked.notes}
                                    </p>
                                  )}
                                  <p className="mt-2 text-[10px] text-muted-foreground/60">
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
        </DragDropContext>
      )}

      {/* Job Detail Modal */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedJob?.job?.title}</DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CompanyLogo company={selectedJob.job?.company || 'Unknown'} size={48} />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{selectedJob.job?.company}</p>
                  <p className="text-xs text-muted-foreground">{selectedJob.job?.location}</p>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
