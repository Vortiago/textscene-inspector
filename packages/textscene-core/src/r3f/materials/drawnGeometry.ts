/**
 * The read-back of the geometry a surface draw holds, for a chain that covers a draw it does not build.
 */

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import type * as THREE from 'three';

/**
 * Reads the geometry off the base draw, in place across re-parses. Dep-less, since a
 * re-parse replaces the geometry and a `[ref]` list would keep the old one; the updater
 * returns the same value when nothing moved, so the pair cannot loop. The layout pass
 * swaps a re-parsed geometry before paint, and on mount it runs before the parent's
 * ref lands, so the passive pass reads the first geometry.
 *
 * @canonical The geometry a surface draw reads back
 */
export function useDrawnGeometry(ref: RefObject<THREE.Object3D | null>): THREE.BufferGeometry | null {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const readBack = () => {
    const attached = (ref.current as { geometry?: THREE.BufferGeometry } | null)?.geometry ?? null;
    setGeometry((previous) => (previous === attached ? previous : attached));
  };
  useLayoutEffect(readBack);
  useEffect(readBack);
  return geometry;
}
