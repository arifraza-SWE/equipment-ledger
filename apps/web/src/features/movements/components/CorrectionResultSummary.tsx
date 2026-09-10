import type { CorrectionResult } from '@equipment-ledger/shared';
import { AssetStatusBadge } from '@/components/AssetStatusBadge';
import { Notice } from '@/components/Notice';
import { TimestampPair } from '@/components/TimestampPair';
import formStyles from '@/components/Form.module.css';
import type { WorkerNamesById } from '@/features/workers/worker-names';
import { CorrectionChangesList } from './CorrectionChangesList';

interface CorrectionResultSummaryProps {
  result: CorrectionResult;
  replayed: boolean;
  workerNamesById: WorkerNamesById;
}

export function CorrectionResultSummary({
  result,
  replayed,
  workerNamesById,
}: CorrectionResultSummaryProps) {
  const { correction, replacement, asset } = result;

  return (
    <Notice
      tone="success"
      title={correction.kind === 'void' ? 'Movement voided' : 'Movement amended'}
    >
      <dl className={formStyles.summary}>
        {replayed && (
          <div>
            <dt>Already recorded</dt>
            <dd>This correction was written on an earlier attempt; the ledger holds it once.</dd>
          </div>
        )}
        <div>
          <dt>Reason</dt>
          <dd>{correction.reason}</dd>
        </div>
        {correction.changes.length > 0 && (
          <div>
            <dt>Changes</dt>
            <dd>
              <CorrectionChangesList
                changes={correction.changes}
                workerNamesById={workerNamesById}
              />
            </dd>
          </div>
        )}
        {replacement && (
          <div>
            <dt>Replacement entry</dt>
            <dd>
              <TimestampPair
                effectiveAt={replacement.effectiveAt}
                recordedAt={replacement.recordedAt}
              />
            </dd>
          </div>
        )}
        <div>
          <dt>Asset now</dt>
          <dd>
            <AssetStatusBadge status={asset.status} />
          </dd>
        </div>
      </dl>
    </Notice>
  );
}
