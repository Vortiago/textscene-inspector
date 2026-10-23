/**
 * A set of keys that components report while they hold them. The set and the actions live in two
 * contexts, so a change to the set re-renders its readers and not each reporter. The undrawn-mesh
 * list, the empty-shape list and the missing-resources panel each make one. With no provider a
 * report does nothing and the set is empty.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useCountedReports, type CountedReports } from '../hooks/useCountedReports.js';

type CountedReportsActions = Pick<CountedReports, 'report' | 'clear' | 'clearAll'>;

const NO_ACTIONS: CountedReportsActions = { report: () => {}, clear: () => {}, clearAll: () => {} };
const NO_KEYS: ReadonlySet<string> = new Set();

export function createCountedReportsContext(displayName: string) {
  const ActionsContext = createContext<CountedReportsActions>(NO_ACTIONS);
  ActionsContext.displayName = `${displayName}Actions`;
  const ReportedContext = createContext<ReadonlySet<string>>(NO_KEYS);
  ReportedContext.displayName = displayName;

  function Provider({ children }: { children: ReactNode }) {
    const { reported, report, clear, clearAll } = useCountedReports();
    const actions = useMemo(() => ({ report, clear, clearAll }), [report, clear, clearAll]);
    return (
      <ActionsContext.Provider value={actions}>
        <ReportedContext.Provider value={reported}>{children}</ReportedContext.Provider>
      </ActionsContext.Provider>
    );
  }

  /** Holds one report of `key` while the caller is mounted. Null reports nothing. */
  function useReportWhile(key: string | null): void {
    const { report, clear } = useContext(ActionsContext);
    useEffect(() => {
      if (key === null) return undefined;
      report(key);
      return () => clear(key);
    }, [key, report, clear]);
  }

  return {
    Provider,
    useReportWhile,
    /** Each key with at least one open report. */
    useReported: () => useContext(ReportedContext),
    /** The actions keep one identity for the provider's life. */
    useActions: () => useContext(ActionsContext),
  };
}
