import { Notice } from './Notice';

export function LoadFailure({ message }: { message: string }) {
  return (
    <Notice tone="error" title="Could not load this page">
      {message}
    </Notice>
  );
}
