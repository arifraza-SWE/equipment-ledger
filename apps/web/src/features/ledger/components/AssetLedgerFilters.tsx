'use client';

import {
  ASSET_KIND_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_STATUSES,
  type AssetKind,
  type AssetStatus,
} from '@equipment-ledger/shared';
import { useId } from 'react';
import { SearchIcon } from '@/components/Icon';
import type { AssetFilterControls } from '../hooks/use-asset-filters';
import styles from './AssetLedgerTable.module.css';

interface AssetLedgerFiltersProps {
  controls: AssetFilterControls;
  totalCount: number;
}

export function AssetLedgerFilters({ controls, totalCount }: AssetLedgerFiltersProps) {
  const baseId = useId();
  const { filters, filteredAssets, kindsPresent } = controls;
  const filtering = filters.status !== '' || filters.kind !== '' || filters.search.trim() !== '';

  return (
    <div className={styles.filters}>
      <div className={styles.filter}>
        <label htmlFor={`${baseId}-status`}>Status</label>
        <select
          id={`${baseId}-status`}
          value={filters.status}
          onChange={(event) => controls.setStatus(event.target.value as AssetStatus | '')}
        >
          <option value="">All statuses</option>
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
          <option value="">All kinds</option>
          {kindsPresent.map((kind) => (
            <option key={kind} value={kind}>
              {ASSET_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>

      <div className={`${styles.filter} ${styles.searchFilter}`}>
        <label htmlFor={`${baseId}-search`}>Search</label>
        <div className={styles.searchWrap}>
          <SearchIcon size={15} className={styles.searchIcon} />
          <input
            id={`${baseId}-search`}
            type="search"
            placeholder="Search by ID, description or holder"
            value={filters.search}
            onChange={(event) => controls.setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.trailing}>
        <p className={styles.count} aria-live="polite">
          <b>{filteredAssets.length}</b> of <b>{totalCount}</b> assets
        </p>
        {filtering && (
          <button type="button" className={styles.clear} onClick={controls.clearFilters}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
