/**
 * Eye-toggle seeding for component tests. Test-only: the `testing/` directories under `src` are
 * excluded from the build.
 */
import { useEffect } from 'react';
import { useSelection } from '../contexts/SelectionContext';

/**
 * Toggles each of `paths` hidden from inside a SelectionProvider once mounted. A toggle flips, so
 * pass one array for the life of the mount: a new one toggles every path again.
 */
export function HiddenSeeder({ paths }: { paths: readonly string[] }): null {
  const { toggleHidden } = useSelection();
  useEffect(() => {
    for (const path of paths) toggleHidden(path);
  }, [paths, toggleHidden]);
  return null;
}
