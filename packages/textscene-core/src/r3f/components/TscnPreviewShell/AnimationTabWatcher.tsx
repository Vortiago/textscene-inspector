import { useEffect } from 'react';
import { useAnimationTransport } from '../../contexts/AnimationTransportContext.js';

/**
 * Effect-only child (inside AnimationTransportProvider): reports whether an
 * AnimationPlayer is registered with the transport — the render-time source of
 * truth for Animation-tab visibility (ADR-0012). Registration follows tree
 * selection and covers instanced players, which never reach the parse-time
 * `flattenedNodes`.
 */
export function AnimationTabWatcher({
  onVisibleChange,
}: {
  onVisibleChange: (visible: boolean) => void;
}) {
  const { hasPlayer } = useAnimationTransport();
  useEffect(() => {
    onVisibleChange(hasPlayer);
  }, [hasPlayer, onVisibleChange]);
  return null;
}
