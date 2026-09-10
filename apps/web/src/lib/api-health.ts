import { apiRequest } from './api-client';

export interface ApiHealth {
  status: 'ok' | 'degraded';
  database: string;
}

export function fetchApiHealth(): Promise<ApiHealth> {
  return apiRequest<ApiHealth>('/health');
}
