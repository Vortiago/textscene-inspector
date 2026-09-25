/**
 * Selection seeding for component tests. Test-only: the `testing/` directories under `src` are
 * excluded from the build.
 */
import { useEffect } from 'react';
import { useSelection } from '../contexts/SelectionContext';

/**
 * Selects `path` from inside a SelectionProvider once mounted, and again whenever `path` changes.
 * Null clears the selection, which is how a test drops a gizmo's selection gate.
 */
export function SelectSeeder({ path }: { path: string | null }): null {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}
