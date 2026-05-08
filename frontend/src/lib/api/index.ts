import { ApiResponse, InterviewRound, InterviewOutcome } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ========== Job Endpoints ==========

export async function getDiscoverJobs(token: string) {
  return fetchApi<any[]>('/api/jobs/discover', {}, token);
}

export async function getJobById(jobId: string) {
  return fetchApi<any>(`/api/jobs/${jobId}`);
}

export async function dismissJob(jobId: string, token: string) {
  return fetchApi('/api/jobs/' + jobId + '/dismiss', { method: 'POST' }, token);
}

export async function applyClicked(jobId: string, token: string) {
  return fetchApi('/api/jobs/' + jobId + '/apply-clicked', { method: 'POST' }, token);
}

export async function applyConfirmed(jobId: string, token: string) {
  return fetchApi('/api/jobs/' + jobId + '/apply-confirmed', { method: 'POST' }, token);
}

// ========== Tracked Jobs Endpoints ==========

export async function getTrackedJobs(token: string) {
  return fetchApi<any[]>('/api/tracked-jobs', {}, token);
}

export async function updateTrackedJobStatus(trackedJobId: string, status: string, token: string) {
  return fetchApi(`/api/tracked-jobs/${trackedJobId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token);
}

export async function updateTrackedJobNotes(trackedJobId: string, notes: string, token: string) {
  return fetchApi(`/api/tracked-jobs/${trackedJobId}/notes`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  }, token);
}

export async function updateTrackedJob(trackedJobId: string, updates: { status?: string; notes?: string }, token: string) {
  return fetchApi(`/api/tracked-jobs/${trackedJobId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }, token);
}

export async function deleteTrackedJob(trackedJobId: string, token: string) {
  return fetchApi(`/api/tracked-jobs/${trackedJobId}`, {
    method: 'DELETE',
  }, token);
}

// ========== Interview Rounds Endpoints ==========

export interface InterviewRoundInput {
  round_name: string;
  scheduled_at?: string | null;
  interviewer?: string | null;
  notes?: string | null;
  outcome?: InterviewOutcome;
}

export async function getInterviewRounds(trackedJobId: string, token: string) {
  return fetchApi<InterviewRound[]>(
    `/api/interview-rounds?tracked_job_id=${encodeURIComponent(trackedJobId)}`,
    {},
    token
  );
}

export async function createInterviewRound(
  trackedJobId: string,
  input: InterviewRoundInput,
  token: string
) {
  return fetchApi<InterviewRound>(
    '/api/interview-rounds',
    {
      method: 'POST',
      body: JSON.stringify({ tracked_job_id: trackedJobId, ...input }),
    },
    token
  );
}

export async function updateInterviewRound(
  roundId: string,
  updates: Partial<InterviewRoundInput>,
  token: string
) {
  return fetchApi<InterviewRound>(
    `/api/interview-rounds/${roundId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    },
    token
  );
}

export async function deleteInterviewRound(roundId: string, token: string) {
  return fetchApi(`/api/interview-rounds/${roundId}`, { method: 'DELETE' }, token);
}
  
// ========== Admin Endpoints ==========

export async function adminLogin(password: string) {
  return fetchApi<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function getAdminJobs(token: string, page = 1, search = '', salaryOnly = false) {
  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (search) params.set('search', search);
  if (salaryOnly) params.set('salaryOnly', 'true');
  return fetchApi<{ jobs: any[]; total: number }>(`/api/admin/jobs?${params}`, {
    headers: { 'x-admin-token': token } as any,
  });
}

export async function updateAdminJob(jobId: string, updates: any, token: string) {
  return fetchApi(`/api/admin/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
    headers: { 'x-admin-token': token } as any,
  });
}

export async function runAdminScrape(token: string) {
  return fetchApi<any>('/api/admin/scrape/run', {
    method: 'POST',
    headers: { 'x-admin-token': token } as any,
  });
}

export async function runAdminSingleScrape(url: string, token: string, company?: string, title?: string) {
  return fetchApi<any>('/api/admin/scrape/single', {
    method: 'POST',
    body: JSON.stringify({ url, company, title }),
    headers: { 'x-admin-token': token } as any,
  });
}

export async function runAdminCleanup(token: string) {
  return fetchApi<{ deletedInvalidCompanies: number; fixedMultiLocations: number }>('/api/admin/cleanup', {
    method: 'POST',
    headers: { 'x-admin-token': token } as any,
  });
}

export async function getAdminSalaryOnly(token: string) {
  return fetchApi<{ enabled: boolean }>('/api/admin/settings/salary-only', {
    headers: { 'x-admin-token': token } as any,
  });
}

export async function setAdminSalaryOnly(enabled: boolean, token: string) {
  return fetchApi<{ enabled: boolean }>('/api/admin/settings/salary-only', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
    headers: { 'x-admin-token': token } as any,
  });
}
