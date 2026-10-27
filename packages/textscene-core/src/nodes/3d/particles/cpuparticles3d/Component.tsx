/**
 * <CPUParticles3D> draws no particles, so the intent is `pending` and the badge reads "not
 * implemented". The GeometryInstance3D base still mounts, with Godot's editor gizmos on it
 * (`undrawnGeometryInstanceWithGizmos`): the `visibility_aabb` box with its axes for every node,
 * and the emission shape for the selected node.
 */

import { EMPTY_AABB } from '../../../../godot/math/aabb';
import { SelectedOnly } from '../../../../r3f/gizmo/PluginGizmo';
import {
  undrawnGeometryInstanceWithGizmos,
  type GeometryInstanceGizmosProps,
} from '../../geometryinstance3d/Component';
import { CPUParticlesBoxGizmo, EmissionShapeGizmo } from '../gizmo/ParticleGizmos';
import { useCPUParticles3DAabb } from './ownAabb';
import type { CPUParticles3DProperties } from './types';

function Gizmos({ properties }: GeometryInstanceGizmosProps<CPUParticles3DProperties>) {
  return (
    <>
      {/* The box the node authors, `AABB()` for none, and not the parser's null (the multimesh box). */}
      <CPUParticlesBoxGizmo box={properties.visibilityAabb ?? EMPTY_AABB} />
      <SelectedOnly>
        <EmissionShapeGizmo emission={properties.emission} />
      </SelectedOnly>
    </>
  );
}

export const CPUParticles3D = undrawnGeometryInstanceWithGizmos(useCPUParticles3DAabb, Gizmos, 'every-node');
