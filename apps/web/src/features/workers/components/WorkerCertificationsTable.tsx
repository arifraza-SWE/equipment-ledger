import { CERTIFICATION_LABELS, type WorkerCertification } from '@equipment-ledger/shared';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDay } from '@/lib/site-time';
import { isCertificationExpired } from '../domain/certification-standing';

export function WorkerCertificationsTable({
  certifications,
}: {
  certifications: WorkerCertification[];
}) {
  if (certifications.length === 0) {
    return <EmptyState title="No certificates on file" />;
  }

  return (
    <DataTable caption="Certificates">
      <thead>
        <tr>
          <th scope="col">Certificate</th>
          <th scope="col">Issued</th>
          <th scope="col">Expires</th>
          <th scope="col">Standing</th>
        </tr>
      </thead>
      <tbody>
        {certifications.map((certification) => {
          const expired = isCertificationExpired(certification.expiresAt, null);
          return (
            <tr key={certification.type}>
              <th scope="row">{CERTIFICATION_LABELS[certification.type]}</th>
              <td>{formatDay(certification.issuedAt)}</td>
              <td>{formatDay(certification.expiresAt)}</td>
              <td>
                <StatusBadge tone={expired ? 'overdue' : 'in_store'}>
                  {expired ? 'Expired' : 'Valid'}
                </StatusBadge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
