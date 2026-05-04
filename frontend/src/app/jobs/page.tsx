'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreVertical, Mail, RefreshCw, ChevronDown, Check, ExternalLink, Trash2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  const fetchJobs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const res = await fetch(`${API_URL}/jobs`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setJobs(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/jobs/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        await fetchJobs();
      } else {
        // Handle error (maybe redirect to auth)
        if (data.error === 'Gmail not connected') {
          handleConnectGmail();
        }
      }
    } catch (err) {
      console.error('Failed to sync', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const res = await fetch(`${API_URL}/gmail/auth`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to get auth url', err);
    }
  };

  const fetchTimeline = async (jobId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const res = await fetch(`${API_URL}/jobs/${jobId}/timeline`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setTimeline(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch timeline', err);
    }
  };

  const openJobDetails = (job: any) => {
    setSelectedJob(job);
    setTimeline([]);
    setIsDrawerOpen(true);
    fetchTimeline(job.id);
  };

  const updateStatus = async (jobId: string, status: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setJobs(jobs.map(j => j.id === jobId ? { ...j, status, last_updated: new Date().toISOString() } : j));
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob({ ...selectedJob, status });
          fetchTimeline(jobId);
        }
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleDelete = (jobId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setIdToDelete(jobId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    
    const jobId = idToDelete;
    const promise = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${API_URL}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to delete');
      
      setJobs(jobs.filter(j => j.id !== jobId));
      if (selectedJob && selectedJob.id === jobId) {
        setIsDrawerOpen(false);
        setSelectedJob(null);
      }
      return data;
    })();

    toast.promise(promise, {
      loading: 'Removing application...',
      success: 'Application removed successfully',
      error: (err) => err.message || 'Failed to remove application',
    });

    setIsDeleteDialogOpen(false);
    setIdToDelete(null);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'offer': { label: 'Offer', color: 'bg-green-500 hover:bg-green-600' },
      'rejected': { label: 'Rejected', color: 'bg-red-500 hover:bg-red-600' },
      'interview_scheduled': { label: 'Interview Scheduled', color: 'bg-blue-500 hover:bg-blue-600' },
      'in_review': { label: 'In Review', color: 'bg-yellow-500 hover:bg-yellow-600 text-yellow-950' },
      'applied': { label: 'Applied', color: 'bg-gray-400 hover:bg-gray-500' },
    };
    const s = statusMap[status] || statusMap['applied'];
    return (
      <Badge className={`${s.color} border-none`}>{s.label}</Badge>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Job Applications</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track and manage your automated job hunt</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleConnectGmail}>
            <Mail className="w-4 h-4 mr-2" />
            Connect Gmail
          </Button>
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Gmail'}
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Company</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Date Applied</th>
                <th className="px-6 py-4 font-medium">Last Updated</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading applications...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No job applications found. Connect Gmail and sync to get started.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr 
                    key={job.id} 
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => openJobDetails(job)}
                  >
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {job.company}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {job.role}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {new Date(job.date_applied).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {new Date(job.last_updated).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <a 
                          href={`https://mail.google.com/mail/u/0/#inbox/${job.gmail_thread_id}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 p-2"
                          onClick={(e) => e.stopPropagation()}
                          title="View in Gmail"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={(e) => e.stopPropagation()}
                              />
                            }
                          >
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => updateStatus(job.id, 'applied', e)}>Set as Applied</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => updateStatus(job.id, 'in_review', e)}>Set as In Review</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => updateStatus(job.id, 'interview_scheduled', e)}>Set as Interview</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => updateStatus(job.id, 'offer', e)}>Set as Offer</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => updateStatus(job.id, 'rejected', e)}>Set as Rejected</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                              onClick={(e) => handleDelete(job.id, e)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          {selectedJob && (
            <>
              <SheetHeader className="mb-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <SheetTitle className="text-2xl text-gray-900 dark:text-white">{selectedJob.company}</SheetTitle>
                    <SheetDescription className="text-lg mt-1 text-gray-500 dark:text-gray-400">
                      {selectedJob.role}
                    </SheetDescription>
                  </div>
                  <div>
                    {getStatusBadge(selectedJob.status)}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          className="w-full justify-between dark:border-gray-700"
                        />
                      }
                    >
                      Change Status <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full">
                      <DropdownMenuItem onClick={() => updateStatus(selectedJob.id, 'applied')}>
                        {selectedJob.status === 'applied' && <Check className="w-4 h-4 mr-2" />} Applied
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(selectedJob.id, 'in_review')}>
                        {selectedJob.status === 'in_review' && <Check className="w-4 h-4 mr-2" />} In Review
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(selectedJob.id, 'interview_scheduled')}>
                        {selectedJob.status === 'interview_scheduled' && <Check className="w-4 h-4 mr-2" />} Interview Scheduled
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(selectedJob.id, 'offer')}>
                        {selectedJob.status === 'offer' && <Check className="w-4 h-4 mr-2" />} Offer
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(selectedJob.id, 'rejected')}>
                        {selectedJob.status === 'rejected' && <Check className="w-4 h-4 mr-2" />} Rejected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    variant="outline" 
                    className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20"
                    onClick={() => handleDelete(selectedJob.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <a 
                    href={`https://mail.google.com/mail/u/0/#inbox/${selectedJob.gmail_thread_id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button variant="default" className="flex gap-2">
                      <Mail className="w-4 h-4" /> View Email
                    </Button>
                  </a>
                </div>
              </SheetHeader>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Recruiter Info</h3>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                    <p className="font-medium text-gray-900 dark:text-white">{selectedJob.recruiter_name || 'N/A'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedJob.recruiter_email || 'No email found'}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Application Timeline</h3>
                  <div className="relative border-l border-gray-200 dark:border-gray-700 ml-3 space-y-6">
                    {timeline.length === 0 ? (
                      <p className="pl-6 text-gray-500">Loading timeline...</p>
                    ) : timeline.map((event, i) => (
                      <div key={event.id} className="relative pl-6">
                        <div className="absolute w-3 h-3 bg-blue-600 rounded-full -left-[6.5px] top-1.5 ring-4 ring-white dark:ring-gray-900"></div>
                        <div className="mb-1 text-sm font-normal text-gray-400 dark:text-gray-500">
                          {new Date(event.event_date).toLocaleString()}
                        </div>
                        <div className="mb-2">
                          {getStatusBadge(event.status)}
                        </div>
                        {event.email_snippet && (
                          <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-md italic">
                            "{event.email_snippet}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <AlertDialogTitle>Remove Application</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to remove this application? This action cannot be undone and will remove the application from your tracking list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white border-none"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
