import { ASSET_STATUS_LABELS, type AssetStatus } from '@equipment-ledger/shared';
import { StatusBadge } from './StatusBadge';

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return <StatusBadge tone={status}>{ASSET_STATUS_LABELS[status]}</StatusBadge>;
}
