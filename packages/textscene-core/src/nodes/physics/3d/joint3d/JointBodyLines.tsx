/**
 * The lines a joint draws toward each body it resolved: body A in its colour, then body B. A body
 * that did not resolve draws none (`joint_3d_gizmo_plugin.cpp:325-337`).
 */

import { useMemo } from 'react';
import type { Transform3D } from '../../../../godot/math/transform3d';
import { JointGizmoLines } from './JointGizmoLines';
import type { BodyPart } from './jointGizmoDrawer';
import type { JointBodies } from './useJointBodies';

/** Builds the segments for one body. It must keep its identity across renders, or every line rebuilds. */
export type BodySegments = (joint: Transform3D, body: Transform3D, part: BodyPart) => Float32Array;

interface BodyLinesProps {
  part: BodyPart;
  joint: Transform3D;
  body: Transform3D;
  segmentsFor: BodySegments;
}

function BodyLines({ part, joint, body, segmentsFor }: BodyLinesProps) {
  const positions = useMemo(() => segmentsFor(joint, body, part), [segmentsFor, joint, body, part]);
  return <JointGizmoLines part={part} positions={positions} />;
}

export function JointBodyLines({ bodies, segmentsFor }: { bodies: JointBodies; segmentsFor: BodySegments }) {
  return (
    <>
      {bodies.bodyA && (
        <BodyLines part="bodyA" joint={bodies.joint} body={bodies.bodyA} segmentsFor={segmentsFor} />
      )}
      {bodies.bodyB && (
        <BodyLines part="bodyB" joint={bodies.joint} body={bodies.bodyB} segmentsFor={segmentsFor} />
      )}
    </>
  );
}
