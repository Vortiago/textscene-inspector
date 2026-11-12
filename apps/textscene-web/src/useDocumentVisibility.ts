/**
 * Whether the page shows, from `document.visibilityState` and its `visibilitychange` event. The
 * previewer passes it to the shell, so a background tab renders no frame.
 */
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

const isPageVisible = () => document.visibilityState !== 'hidden';

export function useDocumentVisibility(): boolean {
  return useSyncExternalStore(subscribe, isPageVisible, () => true);
}
