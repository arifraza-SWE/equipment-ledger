const STORAGE_KEY = 'equipment-ledger.keeper';

export function readStoredKeeperId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeKeeperId(keeperId: string | null): void {
  try {
    if (keeperId === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, keeperId);
    }
  } catch {
    return;
  }
}
