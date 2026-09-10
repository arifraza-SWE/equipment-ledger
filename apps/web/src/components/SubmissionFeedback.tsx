import type { ReactNode } from 'react';
import type { SubmissionState } from '@/hooks/use-ledger-submission';
import { Notice } from './Notice';

interface SubmissionFeedbackProps<TResult> {
  state: SubmissionState<TResult>;
  renderSuccess: (result: TResult, replayed: boolean) => ReactNode;
}

export function SubmissionFeedback<TResult>({
  state,
  renderSuccess,
}: SubmissionFeedbackProps<TResult>) {
  switch (state.phase) {
    case 'refused':
      return (
        <Notice tone="error" title="The store refused this">
          {state.message}
        </Notice>
      );
    case 'unconfirmed':
      return (
        <Notice tone="warning" title="Not confirmed">
          {state.message}
        </Notice>
      );
    case 'succeeded':
      return <>{renderSuccess(state.result, state.replayed)}</>;
    default:
      return null;
  }
}
