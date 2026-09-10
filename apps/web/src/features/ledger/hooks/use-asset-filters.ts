'use client';

import {
  ASSET_KIND_LABELS,
  type AssetKind,
  type AssetSnapshot,
  type AssetStatus,
} from '@equipment-ledger/shared';
import { useMemo, useState } from 'react';

export interface AssetFilters {
  status: AssetStatus | '';
  kind: AssetKind | '';
  search: string;
}

export interface AssetFilterControls {
  filters: AssetFilters;
  setStatus: (status: AssetStatus | '') => void;
  setKind: (kind: AssetKind | '') => void;
  setSearch: (search: string) => void;
  filteredAssets: AssetSnapshot[];
  kindsPresent: AssetKind[];
}

export function useAssetFilters(assets: readonly AssetSnapshot[]): AssetFilterControls {
  const [filters, setFilters] = useState<AssetFilters>({ status: '', kind: '', search: '' });

  const kindsPresent = useMemo(
    () => [...new Set(assets.map((snapshot) => snapshot.asset.kind))],
    [assets],
  );

  const filteredAssets = useMemo(
    () => assets.filter((snapshot) => matchesFilters(snapshot, filters)),
    [assets, filters],
  );

  return {
    filters,
    setStatus: (status) => setFilters((current) => ({ ...current, status })),
    setKind: (kind) => setFilters((current) => ({ ...current, kind })),
    setSearch: (search) => setFilters((current) => ({ ...current, search })),
    filteredAssets,
    kindsPresent,
  };
}

function matchesFilters(snapshot: AssetSnapshot, filters: AssetFilters): boolean {
  if (filters.status && snapshot.status !== filters.status) {
    return false;
  }
  if (filters.kind && snapshot.asset.kind !== filters.kind) {
    return false;
  }
  const needle = filters.search.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  const haystack = [
    snapshot.asset.assetId,
    snapshot.asset.description,
    ASSET_KIND_LABELS[snapshot.asset.kind],
    snapshot.holding?.worker.fullName ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}
