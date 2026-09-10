const STORAGE_PREFIX = 'equipment-ledger.idempotency.';

export function loadOrCreateIdempotencyKey(formName: string): string {
  const storedKey = readStorage(formName);
  return storedKey ?? replaceIdempotencyKey(formName);
}

export function replaceIdempotencyKey(formName: string): string {
  const freshKey = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + formName, freshKey);
  } catch {
    return freshKey;
  }
  return freshKey;
}

function readStorage(formName: string): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + formName);
  } catch {
    return null;
  }
}
