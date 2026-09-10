import type { Worker, WorkerDetail } from '@equipment-ledger/shared';
import { apiRequest } from '@/lib/api-client';

export function fetchWorkers(): Promise<Worker[]> {
  return apiRequest<Worker[]>('/workers');
}

export function fetchWorkerDetail(workerId: string): Promise<WorkerDetail> {
  return apiRequest<WorkerDetail>(`/workers/${encodeURIComponent(workerId)}`);
}
