import { useSyncExternalStore } from 'react';
import { useViewShow } from '../viewShow/ViewShowContext.js';
import { useViewStatusStore } from '../viewStatus/ViewStatusContext.js';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
import { PerformancePanel } from './PerformancePanel.js';

export function PerformanceOverlay() {
  return useViewShow().performance ? <MeasuredPanel /> : null;
}

function MeasuredPanel() {
  const store = useViewStatusStore();
  const stats = useSyncExternalStore(
    store?.subscribe ?? subscribeToNothing,
    () => store?.status().frame ?? null
  );
  return <PerformancePanel stats={stats} />;
}
