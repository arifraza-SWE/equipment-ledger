'use client';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';

export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <PageHeader title="Something went wrong" />
      <Notice tone="error" title="This page could not be drawn">
        <p>Nothing has been recorded by this page. Try again, or check that the API is running.</p>
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      </Notice>
    </>
  );
}
