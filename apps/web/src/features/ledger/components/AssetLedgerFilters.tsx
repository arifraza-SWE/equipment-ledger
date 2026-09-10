'use client';

import {
  ASSET_KIND_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_STATUSES,
  type AssetKind,
  type AssetStatus,
} from '@equipment-ledger/shared';
import { useId } from 'react';
import type { AssetFilterControls } from '../hooks/use-asset-filters';
import styles from './AssetLedgerTable.module.css';

interface AssetLedgerFiltersProps {
  controls: AssetFilterControls;
  totalCount: number;
}

export function AssetLedgerFilters({ controls, totalCount }: AssetLedgerFiltersProps) {
  const baseId = useId();
  const { filters, filteredAssets, kindsPresent } = controls;

  return (
    <div className={styles.filters}>
      <div className={styles.filter}>
        <label htmlFor={`${baseId}-status`}>Status</label>
        <select
          id={`${baseId}-status`}
          value={filters.status}
          onChange={(event) => controls.setStatus(event.target.value as AssetStatus | '')}
        >
          <option value="">All</option>
          {ASSET_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ASSET_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.filter}>
        <label htmlFor={`${baseId}-kind`}>Kind</label>
        <select
          id={`${baseId}-kind`}
          value={filters.kind}
          onChange={(event) => controls.setKind(event.target.value as AssetKind | '')}
        >
          <option value="">All</option>
          {kindsPresent.map((kind) => (
            <option key={kind} value={kind}>
              {ASSET_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>
      <div className={`${styles.filter} ${styles.searchFilter}`}>
        <label htmlFor={`${baseId}-search`}>Search</label>
        <input
          id={`${baseId}-search`}
          type="search"
          placeholder="Id, description or holder"
          value={filters.search}
          onChange={(event) => controls.setSearch(event.target.value)}
        />
      </div>
      <p className={styles.count} aria-live="polite">
        <span className="mono">{filteredAssets.length}</span> of{' '}
        <span className="mono">{totalCount}</span> assets
      </p>
    </div>
  );
}
