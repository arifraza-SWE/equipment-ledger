'use client';

import type { Correction, MovementWithNames, Worker } from '@equipment-ledger/shared';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { MovementTypeBadge } from '@/components/MovementTypeBadge';
import { TimestampPair } from '@/components/TimestampPair';
import { CorrectMovementForm } from '@/features/movements/components/CorrectMovementForm';
import styles from './AssetHistory.module.css';

interface AssetTimelineEntryProps {
  entry: MovementWithNames;
  supersededBy: Correction | null;
  createdBy: Correction | null;
  workers: Worker[];
}

export function AssetTimelineEntry({
  entry,
  supersededBy,
  createdBy,
  workers,
}: AssetTimelineEntryProps) {
  const [correcting, setCorrecting] = useState(false);
  const { movement } = entry;
  const superseded = supersededBy !== null;

  return (
    <li
      id={`movement-${movement.movementId}`}
      className={styles.entry}
      data-movement-type={movement.type}
      data-superseded={superseded}
    >
      <div className={styles.entryHead}>
        <MovementTypeBadge type={movement.type} />
        <span className={styles.parties}>{describeParties(entry)}</span>
        <span className={styles.keeper}>keeper {entry.keeper.fullName}</span>
        <span className={styles.markers}>
          {supersededBy && (
            <a href={`#correction-${supersededBy.correctionId}`} className={styles.marker}>
              corrected
            </a>
          )}
          {createdBy && (
            <a href={`#correction-${createdBy.correctionId}`} className={styles.marker}>
              entered by correction
            </a>
          )}
        </span>
        {!superseded && !correcting && (
          <Button variant="quiet" onClick={() => setCorrecting(true)}>
            Correct
          </Button>
        )}
      </div>
      <TimestampPair effectiveAt={movement.effectiveAt} recordedAt={movement.recordedAt} />
      {movement.dueAt && (
        <p className={styles.entryDetail}>
          Due back <time dateTime={movement.dueAt}>{describeDue(movement.dueAt)}</time>
        </p>
      )}
      {movement.note && <p className={styles.entryNote}>{movement.note}</p>}
      {correcting && (
        <div className={styles.entryForm}>
          <CorrectMovementForm
            movement={movement}
            workers={workers}
            onClose={() => setCorrecting(false)}
          />
        </div>
      )}
    </li>
  );
}

function describeParties({ movement, worker, returnedBy }: MovementWithNames): string {
  if (movement.type === 'issue') {
    return worker ? `to ${worker.fullName}` : '';
  }
  if (movement.type === 'return') {
    const from = worker ? `from ${worker.fullName}` : '';
    const handedBack =
      returnedBy && returnedBy.workerId !== worker?.workerId
        ? `, handed back by ${returnedBy.fullName}`
        : '';
    return `${from}${handedBack}`;
  }
  return '';
}

function describeDue(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
