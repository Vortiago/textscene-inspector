/**
 * Hover seeding for component tests. Test-only: the `testing/` directories under `src` are
 * excluded from the build.
 */
import { useEffect } from 'react';
import { useSelection } from '../contexts/SelectionContext';

/**
 * Hovers `path` from inside a SelectionProvider once mounted, and again whenever `path` changes.
 * Null clears the hover.
 */
export function HoverSeeder({ path }: { path: string | null }): null {
  const { hoverStore } = useSelection();
  useEffect(() => {
    hoverStore.set(path);
  }, [path, hoverStore]);
  return null;
}
