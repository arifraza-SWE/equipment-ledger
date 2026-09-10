import { CERTIFICATION_LABELS, type Worker } from '@equipment-ledger/shared';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { formatDay } from '@/lib/site-time';
import { isCertificationExpired } from '../domain/certification-standing';
import styles from './WorkersTable.module.css';

export function WorkersTable({ workers }: { workers: Worker[] }) {
  if (workers.length === 0) {
    return <EmptyState title="No workers registered" />;
  }

  return (
    <DataTable caption="Workers">
      <thead>
        <tr>
          <th scope="col">Worker</th>
          <th scope="col">Name</th>
          <th scope="col">Trade</th>
          <th scope="col" data-wrap="true">
            Certificates
          </th>
        </tr>
      </thead>
      <tbody>
        {workers.map((worker) => (
          <tr key={worker.workerId}>
            <th scope="row">
              <Link href={`/workers/${encodeURIComponent(worker.workerId)}`} className="mono">
                {worker.workerId}
              </Link>
            </th>
            <td>{worker.fullName}</td>
            <td>{worker.trade}</td>
            <td data-wrap="true">
              {worker.certifications.length === 0 ? (
                <span className="muted">None</span>
              ) : (
                <ul className={styles.certificates}>
                  {worker.certifications.map((certification) => {
                    const expired = isCertificationExpired(certification.expiresAt, null);
                    return (
                      <li key={certification.type} data-expired={expired}>
                        {CERTIFICATION_LABELS[certification.type]}{' '}
                        <span className={styles.expiry}>
                          {expired ? 'expired' : 'until'} {formatDay(certification.expiresAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
