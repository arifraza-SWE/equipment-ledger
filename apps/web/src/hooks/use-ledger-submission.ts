'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { ApiRequestError, type MutationOutcome } from '@/lib/api-client';
import { useIdempotencyKey } from './use-idempotency-key';

export const STORE_DID_NOT_CONFIRM_MESSAGE =
  'The store did not confirm this. Nothing has been recorded unless you see it in the history; retrying is safe.';

export type SubmissionState<TResult> =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'succeeded'; result: TResult; replayed: boolean }
  | { phase: 'refused'; message: string }
  | { phase: 'unconfirmed'; message: string };

export interface LedgerSubmission<TRequest, TResult> {
  state: SubmissionState<TResult>;
  submit: (request: TRequest) => Promise<boolean>;
  ready: boolean;
  submitting: boolean;
}

export function useLedgerSubmission<TRequest, TResult>(
  formName: string,
  send: (request: TRequest, idempotencyKey: string) => Promise<MutationOutcome<TResult>>,
): LedgerSubmission<TRequest, TResult> {
  const router = useRouter();
  const { idempotencyKey, rotateIdempotencyKey } = useIdempotencyKey(formName);
  const [state, setState] = useState<SubmissionState<TResult>>({ phase: 'idle' });
  const inFlight = useRef(false);

  const submit = useCallback(
    async (request: TRequest) => {
      if (idempotencyKey === null || inFlight.current) {
        return false;
      }
      inFlight.current = true;
      setState({ phase: 'submitting' });
      try {
        const outcome = await send(request, idempotencyKey);
        rotateIdempotencyKey();
        setState({ phase: 'succeeded', result: outcome.result, replayed: outcome.replayed });
        router.refresh();
        return true;
      } catch (error) {
        if (error instanceof ApiRequestError && error.statusCode < 500) {
          rotateIdempotencyKey();
          setState({ phase: 'refused', message: error.message });
        } else {
          setState({ phase: 'unconfirmed', message: STORE_DID_NOT_CONFIRM_MESSAGE });
        }
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [idempotencyKey, rotateIdempotencyKey, router, send],
  );

  return {
    state,
    submit,
    ready: idempotencyKey !== null,
    submitting: state.phase === 'submitting',
  };
}
