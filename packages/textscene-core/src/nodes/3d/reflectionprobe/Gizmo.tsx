/**
 * The editor gizmo of a ReflectionProbe: the blend box and the origin cross in the probe colour,
 * and the lines to the outer box at half that opacity. The component gates it with `useGizmoState`.
 */

import { useMemo } from 'react';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { reflectionProbeGizmoLines } from './gizmoLines';
import type { ReflectionProbeProperties } from './types';

/** `editors/3d_gizmos/gizmo_colors/reflection_probe` (`editor_settings.cpp:894`). */
const GIZMO_COLOR = Object.freeze({ r: 0.6, g: 1, b: 0.5 });

/** The alpha of `reflection_internal_material` (`reflection_probe_gizmo_plugin.cpp:46`). */
const INTERNAL_LINES_ALPHA = 0.5;

export function ReflectionProbeGizmo({ probe }: { probe: ReflectionProbeProperties }) {
  const { size, blendDistance, originOffset } = probe;
  const { lines, internalLines } = useMemo(() => {
    const built = reflectionProbeGizmoLines({ size, blendDistance, originOffset });
    return { lines: new Float32Array(built.lines), internalLines: new Float32Array(built.internalLines) };
  }, [size, blendDistance, originOffset]);
  const color = useGodotLinearColor(GIZMO_COLOR);
  return (
    <>
      <GizmoLine positions={lines} color={color} variant="selected" />
      <GizmoLine positions={internalLines} color={color} opacity={INTERNAL_LINES_ALPHA} variant="selected" />
    </>
  );
}
