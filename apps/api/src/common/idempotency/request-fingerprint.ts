import { createHash } from 'node:crypto';

export function fingerprintRequest(method: string, path: string, body: unknown): string {
  return createHash('sha256')
    .update(`${method.toUpperCase()} ${path}\n${stableStringify(body)}`)
    .digest('hex');
}

function stableStringify(candidate: unknown): string {
  if (candidate === null || typeof candidate !== 'object') {
    return JSON.stringify(candidate) ?? 'undefined';
  }
  if (Array.isArray(candidate)) {
    return `[${candidate.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(candidate as Record<string, unknown>)
    .filter(([, propertyValue]) => propertyValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([propertyName, propertyValue]) => `${JSON.stringify(propertyName)}:${stableStringify(propertyValue)}`);
  return `{${entries.join(',')}}`;
}
