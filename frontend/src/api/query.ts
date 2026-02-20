// frontend/src/api/query.ts
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'

// Job status enum
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

// S3 file reference structure
export interface S3FileReference {
  s3_url: string
  row_count: number
  file_size_bytes: number
}

// Structured analysis response from backend
export interface Citation {
  excerpt: string
}

export interface Theme {
  name: string
  summary: string
  supporting_citations: Citation[]
}

export interface AnalysisResponse {
  summary: string
  themes: Theme[]
}

// Result structure (when job is completed)
export interface JobResult {
  response: AnalysisResponse
  cited_responses: S3FileReference
  search_results: S3FileReference
  metadata: {
    execution_time_ms: number
    cited_count: number
  }
}

// Job submission response
export interface JobSubmissionResponse {
  jobId: string
  status: JobStatus
  createdAt: string
  links: {
    self: string
  }
}

// Job status response
export interface JobStatusResponse {
  jobId: string
  status: JobStatus
  createdAt: string
  updatedAt: string
  result?: JobResult
  error?: string
}

// Submit a new job
async function submitJob(query: string): Promise<JobSubmissionResponse> {
  return apiRequest<JobSubmissionResponse>('/jobs', {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}

// Get job status
async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return apiRequest<JobStatusResponse>(`/jobs/${jobId}`)
}

// Hook to submit a job
export function useSubmitJob() {
  return useMutation({
    mutationFn: submitJob,
  })
}

// Hook to poll job status
export function useJobStatus(jobId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId && options?.enabled !== false,
    refetchInterval: (query) => {
      const data = query.state.data
      // Stop polling when job is complete or failed
      if (data?.status === 'COMPLETED' || data?.status === 'FAILED') {
        return false
      }
      // Poll every 3 seconds (from Retry-After header)
      return 3000
    },
  })
}

// Combined hook for submit + poll pattern
export function useQueryWithPolling() {
  const submitMutation = useSubmitJob()
  const jobId = submitMutation.data?.jobId ?? null

  const statusQuery = useJobStatus(jobId, {
    enabled: submitMutation.isSuccess,
  })

  return {
    submit: submitMutation.mutate,
    submitAsync: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error,
    jobId,
    status: statusQuery.data?.status,
    result: statusQuery.data?.result,
    jobError: statusQuery.data?.error,
    isPolling: submitMutation.isSuccess && !['COMPLETED', 'FAILED'].includes(statusQuery.data?.status ?? ''),
    isComplete: statusQuery.data?.status === 'COMPLETED',
    isFailed: statusQuery.data?.status === 'FAILED',
    reset: () => {
      submitMutation.reset()
    },
  }
}

// Legacy export for backwards compatibility
export type QueryResponse = JobResult
export const useSubmitQuery = useQueryWithPolling
