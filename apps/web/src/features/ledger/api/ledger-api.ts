import type { AssetSnapshot, StoreSnapshot } from '@equipment-ledger/shared';
import { apiRequest } from '@/lib/api-client';

export function fetchStoreSnapshot(at?: string): Promise<StoreSnapshot> {
  return apiRequest<StoreSnapshot>('/ledger/as-of', { query: { at } });
}

export function fetchAssetSnapshots(): Promise<AssetSnapshot[]> {
  return apiRequest<AssetSnapshot[]>('/assets');
}
