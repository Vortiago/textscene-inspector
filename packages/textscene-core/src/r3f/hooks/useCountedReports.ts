import { useState, useSyncExternalStore } from 'react';
import { CountedReports } from '../../utils/countedReports.js';

/** A {@link CountedReports} for the component's life: its actions keep one identity. */
export function useCountedReports(): Pick<CountedReports, 'report' | 'clear'> & {
  reported: ReadonlySet<string>;
} {
  const [reports] = useState(() => new CountedReports());
  const reported = useSyncExternalStore(reports.subscribe, reports.keys, reports.keys);
  return { reported, report: reports.report, clear: reports.clear };
}
