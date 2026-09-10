'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { siteWallClockFromIso, isoFromSiteWallClock, siteWallClockNow } from '@/lib/site-time';
import styles from './AsOfLedgerView.module.css';

interface QuickPick {
  label: string;
  instant: () => Date;
}

const QUICK_PICKS: readonly QuickPick[] = [
  { label: 'Now', instant: () => new Date() },
  { label: '1 hour ago', instant: () => new Date(Date.now() - 60 * 60 * 1000) },
  { label: 'Yesterday 14:20', instant: yesterdayAtTwentyPastTwo },
  { label: 'Start of last week', instant: startOfLastWeek },
];

export function AsOfInstantPicker({ initialAt }: { initialAt: string | null }) {
  const router = useRouter();
  const inputId = useId();
  const [inputValue, setInputValue] = useState(siteWallClockFromIso(initialAt));
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (initialAt === null) {
      setInputValue(siteWallClockNow());
    }
  }, [initialAt]);

  const showInstant = (instant: Date) => {
    router.push(`/as-of?at=${encodeURIComponent(instant.toISOString())}`);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const iso = isoFromSiteWallClock(inputValue);
    if (iso === null) {
      setProblem('Enter a date and time.');
      return;
    }
    setProblem(null);
    showInstant(new Date(iso));
  };

  return (
    <form className={styles.picker} onSubmit={handleSubmit}>
      <div className={styles.pickerField}>
        <label htmlFor={inputId}>Show the store as it stood at</label>
        <div className={styles.pickerRow}>
          <input
            id={inputId}
            type="datetime-local"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${inputId}-problem` : undefined}
          />
          <Button type="submit">Show</Button>
        </div>
        {problem && (
          <p id={`${inputId}-problem`} className={styles.pickerProblem}>
            {problem}
          </p>
        )}
      </div>
      <div className={styles.quickPicks} aria-label="Quick picks">
        {QUICK_PICKS.map((quickPick) => (
          <Button
            key={quickPick.label}
            variant="secondary"
            onClick={() => showInstant(quickPick.instant())}
          >
            {quickPick.label}
          </Button>
        ))}
      </div>
    </form>
  );
}

function yesterdayAtTwentyPastTwo(): Date {
  const instant = new Date();
  instant.setDate(instant.getDate() - 1);
  instant.setHours(14, 20, 0, 0);
  return instant;
}

function startOfLastWeek(): Date {
  const instant = new Date();
  const daysSinceMonday = (instant.getDay() + 6) % 7;
  instant.setDate(instant.getDate() - daysSinceMonday - 7);
  instant.setHours(0, 0, 0, 0);
  return instant;
}
