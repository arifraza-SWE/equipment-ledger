'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadOrCreateIdempotencyKey, replaceIdempotencyKey } from '@/lib/idempotency-key';

export function useIdempotencyKey(formName: string): {
  idempotencyKey: string | null;
  rotateIdempotencyKey: () => void;
} {
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    setIdempotencyKey(loadOrCreateIdempotencyKey(formName));
  }, [formName]);

  const rotateIdempotencyKey = useCallback(() => {
    setIdempotencyKey(replaceIdempotencyKey(formName));
  }, [formName]);

  return { idempotencyKey, rotateIdempotencyKey };
}
