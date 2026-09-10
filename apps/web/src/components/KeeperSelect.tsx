'use client';

import { useId } from 'react';
import { useSelectedKeeper } from './KeeperProvider';
import styles from './AppShell.module.css';

export function KeeperSelect() {
  const { keepers, selectedKeeper, selectKeeper } = useSelectedKeeper();
  const selectId = useId();

  return (
    <div className={styles.keeper}>
      <label htmlFor={selectId} className={styles.keeperLabel}>
        Keeper
      </label>
      <select
        id={selectId}
        className={styles.keeperSelect}
        value={selectedKeeper?.keeperId ?? ''}
        onChange={(event) => selectKeeper(event.target.value)}
        disabled={keepers.length === 0}
      >
        <option value="">{keepers.length === 0 ? 'No keepers loaded' : 'Choose keeper'}</option>
        {keepers.map((keeper) => (
          <option key={keeper.keeperId} value={keeper.keeperId}>
            {keeper.fullName} ({keeper.keeperId})
          </option>
        ))}
      </select>
    </div>
  );
}
