/**
 * The editor gizmos that GPUParticles3D and CPUParticles3D share: the box around the emitter, and
 * the lines of its emission shape. `undrawnGeometryInstanceWithGizmos` gates them on the Gizmos
 * toggle and the selection.
 */

import { useMemo } from 'react';
import type { Aabb } from '../../../../godot/math/aabb';
import { AabbAxesGizmo } from '../../../../r3f/components/AabbAxesGizmo';
import { AabbGizmo } from '../../../../r3f/components/AabbGizmo';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import type { GizmoVariant } from '../../../../r3f/gizmo/gizmoVariant';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import type { ParticleEmission } from '../../../../resources/materials/particleprocessmaterial/types';
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
 * The 12 edges of the box and the three unit axes from its centre (`cpu_particles_3d_gizmo_plugin.cpp:67-98`),
 * and the faint fill of a selected box (`:100-103`).
 */
export function CPUParticlesBoxGizmo({ box, variant }: { box: Aabb; variant: GizmoVariant }) {
  return <AabbAxesGizmo aabb={box} color={BOX_COLOR} solidAlpha={SOLID_BOX_ALPHA} variant={variant} />;
}

export function EmissionShapeGizmo({ emission }: { emission: ParticleEmission }) {
  const positions = useMemo(() => new Float32Array(emissionShapeLines(emission)), [emission]);
  return <GizmoLine positions={positions} color={useGodotLinearColor(EMISSION_SHAPE_COLOR)} />;
}
