import { MOVEMENT_TYPE_LABELS, type MovementType } from '@equipment-ledger/shared';
import { StatusBadge, type BadgeTone } from './StatusBadge';

const MOVEMENT_TONE: Record<MovementType, BadgeTone> = {
  issue: 'issued',
  return: 'in_store',
  out_of_service: 'out_of_service',
  back_in_service: 'neutral',
};

export function MovementTypeBadge({ type }: { type: MovementType }) {
  return <StatusBadge tone={MOVEMENT_TONE[type]}>{MOVEMENT_TYPE_LABELS[type]}</StatusBadge>;
}
