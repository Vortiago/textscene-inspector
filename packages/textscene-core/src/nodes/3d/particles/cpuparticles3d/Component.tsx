/**
 * <CPUParticles3D> draws no particles, so the intent is `pending` and the badge reads "not
 * implemented". The GeometryInstance3D base still mounts (`undrawnGeometryInstance`), and while the
 * node is selected (ADR-0018) it carries Godot's editor gizmos: the `visibility_aabb` box with its
 * axes, and the emission shape.
 */

import { EMPTY_AABB } from '../../../../godot/math/aabb';
import { PARTICLE_EMISSION_DEFAULTS } from '../../../../godot/scene/particles3d';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { useGizmoVisible } from '../../../../r3f/hooks/useGizmoVisible';
import { invisibleBase } from '../../../../r3f/invisibleBase';
import { undrawnGeometryInstance } from '../../geometryinstance3d/Component';
import { CPUParticlesBoxGizmo, EmissionShapeGizmo } from '../gizmo/ParticleGizmos';
import { useCPUParticles3DAabb } from './ownAabb';
import type { CPUParticles3DProperties } from './types';

const UndrawnCPUParticles3D = undrawnGeometryInstance(useCPUParticles3DAabb);

function Gizmos({ properties }: { properties: CPUParticles3DProperties }) {
  return (
    <>
      {/* The box the node authors, `AABB()` for none, and not the parser's null (the multimesh box). */}
      <CPUParticlesBoxGizmo box={properties.visibilityAabb ?? EMPTY_AABB} />
      <EmissionShapeGizmo
        emission={properties.emission}
        offset={PARTICLE_EMISSION_DEFAULTS.shapeOffset}
        scale={PARTICLE_EMISSION_DEFAULTS.shapeScale}
      />
    </>
  );
}

export const CPUParticles3D = invisibleBase(function CPUParticles3D({ node, children }: NodeComponentProps) {
  const gizmoVisible = useGizmoVisible();
  return (
    <UndrawnCPUParticles3D node={node}>
      {gizmoVisible && <Gizmos properties={node.properties as CPUParticles3DProperties} />}
      {children}
    </UndrawnCPUParticles3D>
  );
});
