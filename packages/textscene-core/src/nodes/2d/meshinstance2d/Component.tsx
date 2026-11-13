/**
 * Draws a MeshInstance2D: a CanvasItem2D whose body is the mesh `useMeshInstanceContent` reads, drawn once
 * (`CanvasMeshItem`). A node with no mesh, or one Godot builds no surface for, draws nothing and its
 * children still draw (`mesh_instance_2d.cpp:45-53`).
 */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasMeshItem } from '../../../r3f/components/CanvasMeshItem';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useMeshInstanceContent } from '../../3d/meshinstance3d/Component';
import type { MeshInstance2DProperties } from './types';

export function MeshInstance2D({ node, children }: NodeComponentProps) {
  const props = node.properties as MeshInstance2DProperties;
  const content = useMeshInstanceContent(props.mesh, useSceneResources());

  return (
    <CanvasMeshItem node={node} props={props} mesh={content.kind === 'surfaced' ? content.mesh : null}>
      {children}
    </CanvasMeshItem>
  );
}
