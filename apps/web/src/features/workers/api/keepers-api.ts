import type { Keeper } from '@equipment-ledger/shared';
import { apiRequest } from '@/lib/api-client';

export function fetchKeepers(): Promise<Keeper[]> {
  return apiRequest<Keeper[]>('/keepers');
}
