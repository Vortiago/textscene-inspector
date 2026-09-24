import { useEffect } from 'react';
import { useAnimationTransport } from '../../contexts/AnimationTransportContext.js';

/**
 * Reports whether an AnimationPlayer is registered with the transport, which
 * decides the Animation tab (ADR-0012). Registration follows the selection and
 * covers instanced players, which `flattenedNodes` never holds.
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
