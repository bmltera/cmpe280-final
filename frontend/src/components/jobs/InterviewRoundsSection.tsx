'use client';

import { useEffect, useState, useCallback } from 'react';
import { InterviewOutcome, InterviewRound } from '@/types';
import {
  getInterviewRounds,
  createInterviewRound,
  updateInterviewRound,
  deleteInterviewRound,
  InterviewRoundInput,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface Props {
  trackedJobId: string;
  getToken: () => Promise<string | null>;
}

const OUTCOMES: { value: InterviewOutcome; label: string; className: string }[] = [
  { value: 'pending', label: 'Pending', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { value: 'passed', label: 'Passed', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { value: 'failed', label: 'Failed', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
  { value: 'cancelled', label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
];

const outcomeStyle = (o: InterviewOutcome) => OUTCOMES.find((x) => x.value === o)?.className ?? '';

const emptyDraft: InterviewRoundInput = {
  round_name: '',
  scheduled_at: null,
  interviewer: null,
  notes: null,
  outcome: 'pending',
};

/** Convert ISO string to value usable by datetime-local input (local timezone). */
function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function InterviewRoundsSection({ trackedJobId, getToken }: Props) {
  const [rounds, setRounds] = useState<InterviewRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InterviewRoundInput>(emptyDraft);
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchRounds = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    const res = await getInterviewRounds(trackedJobId, token);
    if (res.success && res.data) {
      setRounds(res.data);
    }
    setLoading(false);
  }, [trackedJobId, getToken]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const resetForm = () => {
    setDraft(emptyDraft);
    setScheduledAtLocal('');
    setEditingId(null);
    setShowForm(false);
  };

  const startAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (round: InterviewRound) => {
    setEditingId(round.id);
    setDraft({
      round_name: round.round_name,
      scheduled_at: round.scheduled_at,
      interviewer: round.interviewer,
      notes: round.notes,
      outcome: round.outcome,
    });
    setScheduledAtLocal(toLocalInputValue(round.scheduled_at));
    setShowForm(true);
  };

  const handleSave = async () => {
    const token = await getToken();
    if (!token) return;
    if (!draft.round_name.trim()) {
      toast.error('Round name is required');
      return;
    }
    setBusy(true);
    const payload: InterviewRoundInput = {
      ...draft,
      round_name: draft.round_name.trim(),
      scheduled_at: fromLocalInputValue(scheduledAtLocal),
      interviewer: draft.interviewer?.trim() || null,
      notes: draft.notes?.trim() || null,
    };
    const res = editingId
      ? await updateInterviewRound(editingId, payload, token)
      : await createInterviewRound(trackedJobId, payload, token);
    setBusy(false);
    if (res.success) {
      toast.success(editingId ? 'Round updated' : 'Round added');
      resetForm();
      fetchRounds();
    } else {
      toast.error(res.error || 'Failed to save round');
    }
  };

  const handleDelete = async (round: InterviewRound) => {
    const token = await getToken();
    if (!token) return;
    if (!confirm(`Delete "${round.round_name}"?`)) return;
    const res = await deleteInterviewRound(round.id, token);
    if (res.success) {
      toast.success('Round deleted');
      setRounds((prev) => prev.filter((r) => r.id !== round.id));
    } else {
      toast.error('Failed to delete round');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Interview Rounds</label>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={startAdd}>
            + Add Round
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading rounds...</p>
      ) : rounds.length === 0 && !showForm ? (
        <p className="text-xs text-muted-foreground">No rounds yet. Add one to track interview details.</p>
      ) : (
        <ul className="space-y-2">
          {rounds.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-border/40 bg-card/40 p-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">{r.round_name}</span>
                    <Badge variant="outline" className={outcomeStyle(r.outcome)}>
                      {r.outcome}
                    </Badge>
                  </div>
                  {r.scheduled_at && (
                    <p className="mt-1 text-muted-foreground">
                      {new Date(r.scheduled_at).toLocaleString()}
                    </p>
                  )}
                  {r.interviewer && (
                    <p className="mt-0.5 text-muted-foreground">with {r.interviewer}</p>
                  )}
                  {r.notes && (
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground/80">{r.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(r)}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <>
          <Separator />
          <div className="space-y-2 rounded-md border border-border/40 bg-card/40 p-3">
            <div>
              <label className="text-xs font-medium">Round name</label>
              <Input
                placeholder="e.g. Recruiter Phone Screen"
                value={draft.round_name}
                onChange={(e) => setDraft((d) => ({ ...d, round_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Scheduled at</label>
                <Input
                  type="datetime-local"
                  value={scheduledAtLocal}
                  onChange={(e) => setScheduledAtLocal(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Interviewer</label>
                <Input
                  placeholder="Optional"
                  value={draft.interviewer ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, interviewer: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Outcome</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {OUTCOMES.map((o) => {
                  const active = draft.outcome === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, outcome: o.value }))}
                      className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                        active ? o.className : 'border-border/40 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Notes</label>
              <Textarea
                placeholder="Prep notes, questions asked, follow-ups..."
                rows={3}
                value={draft.notes ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={busy}>
                {busy ? 'Saving...' : editingId ? 'Update Round' : 'Add Round'}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
