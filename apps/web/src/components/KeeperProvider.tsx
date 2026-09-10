'use client';

import type { Keeper } from '@equipment-ledger/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readStoredKeeperId, storeKeeperId } from '@/lib/keeper-storage';

interface KeeperContextValue {
  keepers: Keeper[];
  selectedKeeper: Keeper | null;
  selectKeeper: (keeperId: string) => void;
}

const KeeperContext = createContext<KeeperContextValue | null>(null);

export function KeeperProvider({
  keepers,
  children,
}: {
  keepers: Keeper[];
  children: React.ReactNode;
}) {
  const [selectedKeeperId, setSelectedKeeperId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedKeeperId(readStoredKeeperId());
  }, []);

  const selectKeeper = useCallback((keeperId: string) => {
    const nextKeeperId = keeperId === '' ? null : keeperId;
    setSelectedKeeperId(nextKeeperId);
    storeKeeperId(nextKeeperId);
  }, []);

  const contextValue = useMemo<KeeperContextValue>(
    () => ({
      keepers,
      selectedKeeper: keepers.find((keeper) => keeper.keeperId === selectedKeeperId) ?? null,
      selectKeeper,
    }),
    [keepers, selectedKeeperId, selectKeeper],
  );

  return <KeeperContext.Provider value={contextValue}>{children}</KeeperContext.Provider>;
}

export function useSelectedKeeper(): KeeperContextValue {
  const contextValue = useContext(KeeperContext);
  if (contextValue === null) {
    throw new Error('useSelectedKeeper must be used inside a KeeperProvider');
  }
  return contextValue;
}
