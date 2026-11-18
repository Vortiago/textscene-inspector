import { context } from 'three/tsl';
import type { Node, NodeMaterial } from 'three/webgpu';
import type { TemplateStageNode } from '../template/templateTree.js';

/** A stage pair of one variant: the clip position, and the fragment's colour, emitted when asked. */
export interface EmittedStages {
  readonly position: Node;
  readonly isPositionInvariant: boolean;
  readonly fragment: () => Node;
}

/** Whether `stage` declares `invariant gl_Position;` (`scene_forward_clustered.glsl:185`). */
export const declaresInvariantPosition = (stage: TemplateStageNode): boolean =>
  stage.declarations.some(
    (declaration) => declaration.kind === 'invariant' && declaration.names.includes('gl_Position')
  );

/** Draws `material` at the clip position of `stages`, kept invariant where the template asks. */
export function setPosition(material: NodeMaterial, stages: EmittedStages): void {
  material.vertexNode = stages.position;
  if (stages.isPositionInvariant) material.contextNode = context({ invariant: true });
}
