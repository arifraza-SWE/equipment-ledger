'use client';

import type { AssetSnapshot } from '@equipment-ledger/shared';
import Link from 'next/link';
import { useState } from 'react';
import { AssetStatusBadge } from '@/components/AssetStatusBadge';
import { Button } from '@/components/Button';
import { Instant } from '@/components/Instant';
import { StatusBadge } from '@/components/StatusBadge';
import { ServiceStatusForm } from '@/features/movements/components/ServiceStatusForm';
import { ReservationWindow } from '@/features/reservations/components/ReservationWindow';
import { workerNameOr, type WorkerNamesById } from '@/features/workers/worker-names';
import styles from './AssetHistory.module.css';

interface AssetSnapshotPanelProps {
  snapshot: AssetSnapshot;
  workerNamesById: WorkerNamesById;
}

export function AssetSnapshotPanel({ snapshot, workerNamesById }: AssetSnapshotPanelProps) {
  const [showServiceForm, setShowServiceForm] = useState(false);
  const { holding, asset } = snapshot;
  const reservation = snapshot.currentReservation ?? snapshot.nextReservation;
  const outOfService = snapshot.serviceStatus === 'out_of_service';

  return (
    <section className={styles.panel} aria-label="Current state">
      <dl className={styles.facts}>
        <div>
          <dt>Status</dt>
          <dd className={styles.statusFact}>
            <AssetStatusBadge status={snapshot.status} />
            {holding && outOfService && (
              <StatusBadge tone="out_of_service">Out of service</StatusBadge>
            )}
          </dd>
        </div>
        <div>
          <dt>Held by</dt>
          <dd>
            {holding ? (
              <Link href={`/workers/${encodeURIComponent(holding.worker.workerId)}`}>
                {holding.worker.fullName}
              </Link>
            ) : (
              <span className="muted">In store</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Out since</dt>
          <dd>
            {holding ? <Instant iso={holding.effectiveAt} /> : <span className="muted">–</span>}
          </dd>
        </div>
        <div>
          <dt>Due back</dt>
          <dd className={snapshot.overdue ? styles.overdue : undefined}>
            {holding?.dueAt ? <Instant iso={holding.dueAt} /> : <span className="muted">–</span>}
            {snapshot.overdue && ' · overdue'}
          </dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd>{outOfService ? 'Out of service' : 'In service'}</dd>
        </div>
        <div>
          <dt>{snapshot.currentReservation ? 'Reserved now' : 'Next reservation'}</dt>
          <dd>
            {reservation ? (
              <>
                <ReservationWindow reservation={reservation} /> for{' '}
                {workerNameOr(workerNamesById, reservation.workerId)}
              </>
            ) : (
              <span className="muted">None</span>
            )}
          </dd>
        </div>
      </dl>
      <div className={styles.panelActions}>
        {!showServiceForm && (
          <Button variant="secondary" onClick={() => setShowServiceForm(true)}>
            {outOfService ? 'Return to service' : 'Take out of service'}
          </Button>
        )}
      </div>
      {showServiceForm && (
        <div className={styles.panelForm}>
          <ServiceStatusForm
            assetId={asset.assetId}
            serviceStatus={snapshot.serviceStatus}
            workerNamesById={workerNamesById}
            onClose={() => setShowServiceForm(false)}
          />
        </div>
      )}
    </section>
  );
}
