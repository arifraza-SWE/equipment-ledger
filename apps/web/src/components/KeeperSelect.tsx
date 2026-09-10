'use client';

import { useId } from 'react';
import { ChevronDownIcon, UserIcon } from './Icon';
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
      <div className={styles.keeperControl}>
        <span className={styles.keeperAvatar} aria-hidden="true">
          <UserIcon size={14} />
        </span>
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
        <ChevronDownIcon size={14} className={styles.keeperChevron} />
      </div>
    </div>
  );
}
