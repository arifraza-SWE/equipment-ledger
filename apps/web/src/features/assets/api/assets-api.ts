import type { AssetHistory } from '@equipment-ledger/shared';
import { apiRequest } from '@/lib/api-client';

export function fetchAssetHistory(assetId: string): Promise<AssetHistory> {
  return apiRequest<AssetHistory>(`/assets/${encodeURIComponent(assetId)}/history`);
}
