/**
 * Selection seeding for component tests. Test-only: the `testing/` directories under `src` are
 * excluded from the build.
 */
import { useEffect } from 'react';
import { useSelection } from '../contexts/SelectionContext';
import { useAnimationTransport } from '../contexts/AnimationTransportContext';

/** Selects `path` as the previewer does: the view outlines it, the transport drives it. Null clears both. */
export function SelectSeeder({ path }: { path: string | null }): null {
  const { setSelectedNodePath } = useSelection();
  const { setActivePath } = useAnimationTransport();
  useEffect(() => {
    setSelectedNodePath(path);
    setActivePath(path);
  }, [path, setSelectedNodePath, setActivePath]);
  return null;
}
