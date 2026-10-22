/**
 * The editor gizmos that GPUParticles3D and CPUParticles3D share: the box around the emitter, and
 * the lines of its emission shape. Each mounts under `useGizmoVisible` in the emitter's component.
 */

import { useMemo } from 'react';
import type { Aabb } from '../../../../godot/math/aabb';
import { AabbGizmo } from '../../../../r3f/components/AabbGizmo';
import { AabbSolidGizmo } from '../../../../r3f/components/AabbSolidGizmo';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import type { ParticleEmission } from '../emission/types';
import { centreAxisLines } from './centreAxes';
import { emissionShapeLines } from './emissionShapeLines';

/** `editors/3d_gizmos/gizmo_colors/particles` (`editor_settings.cpp:886`), which both box gizmos draw in. */
const BOX_COLOR = Object.freeze({ r: 0.8, g: 0.7, b: 0.4 });

/**
 * The opacity of the CPUParticles3D solid box: `MAX((a - 0.2) * 0.02, 0)` of the box colour's alpha 1
 * (`cpu_particles_3d_gizmo_plugin.cpp:41`).
 */
const SOLID_BOX_ALPHA = 0.016;

/** `editors/3d_gizmos/gizmo_colors/particles_emission_shape` (`particles_3d_emission_shape_gizmo_plugin.cpp:46`). */
const EMISSION_SHAPE_COLOR = Object.freeze({ r: 0.5, g: 0.7, b: 1 });

/** The 12 edges of the box (`gpu_particles_3d_gizmo_plugin.cpp:67-80`). */
export function ParticlesBoxGizmo({ box }: { box: Aabb }) {
  return <AabbGizmo aabb={box} color={BOX_COLOR} />;
}

/**
 * The 12 edges of the box, the three unit axes from its centre (`cpu_particles_3d_gizmo_plugin.cpp:67-98`)
 * and the faint fill of a selected box (`:100-103`).
 */
export function CPUParticlesBoxGizmo({ box }: { box: Aabb }) {
  const axes = useMemo(() => new Float32Array(centreAxisLines(box)), [box]);
  return (
    <>
      <ParticlesBoxGizmo box={box} />
      <GizmoLine positions={axes} color={useGodotLinearColor(BOX_COLOR)} />
      <AabbSolidGizmo aabb={box} color={BOX_COLOR} alpha={SOLID_BOX_ALPHA} />
    </>
  );
}

export function EmissionShapeGizmo({ emission }: { emission: ParticleEmission }) {
  const positions = useMemo(() => new Float32Array(emissionShapeLines(emission)), [emission]);
  const color = useGodotLinearColor(EMISSION_SHAPE_COLOR);
  // The Point and point-cloud shapes draw no lines, so no geometry or material is built for them.
  if (positions.length === 0) return null;
  return <GizmoLine positions={positions} color={color} />;
}
