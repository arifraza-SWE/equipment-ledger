import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not on the books" />
      <EmptyState title="There is no such asset, worker or page">
        <Link href="/">Back to the ledger</Link>
      </EmptyState>
    </>
  );
}
