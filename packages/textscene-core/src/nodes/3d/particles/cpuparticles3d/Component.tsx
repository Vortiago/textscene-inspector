/**
 * <CPUParticles3D> draws no particles, so the intent is `pending` and the badge reads "not
 * implemented". The GeometryInstance3D base still mounts (`undrawnGeometryInstance`), and while the
 * node is selected (ADR-0018) it carries Godot's editor gizmos: the `visibility_aabb` box with its
 * axes, and the emission shape.
 */

import { EMPTY_AABB } from '../../../../godot/math/aabb';
import { undrawnGeometryInstanceWithGizmos } from '../../geometryinstance3d/Component';
import { CPUParticlesBoxGizmo, EmissionShapeGizmo } from '../gizmo/ParticleGizmos';
import { useCPUParticles3DAabb } from './ownAabb';
import type { CPUParticles3DProperties } from './types';

function Gizmos({ properties }: { properties: CPUParticles3DProperties }) {
  return (
    <>
      {/* The box the node authors, `AABB()` for none, and not the parser's null (the multimesh box). */}
      <CPUParticlesBoxGizmo box={properties.visibilityAabb ?? EMPTY_AABB} />
      <EmissionShapeGizmo emission={properties.emission} />
    </>
  );
}

export const CPUParticles3D = undrawnGeometryInstanceWithGizmos(useCPUParticles3DAabb, Gizmos);
