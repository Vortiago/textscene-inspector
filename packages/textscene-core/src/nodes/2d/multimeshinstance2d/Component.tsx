/**
 * Draws a MultiMeshInstance2D: a CanvasItem2D whose body is its MultiMesh's mesh, drawn for each
 * instance to draw (`CanvasMeshItem`, `multimesh_instance_2d.cpp:63-67`). A node with no MultiMesh
 * or no mesh, a 3D transform format or no instance to draw draws nothing, and its children still
 * draw (`renderer_canvas_render_rd.cpp:2775-2782`).
 */

import { MultiMeshTransformFormat } from '../../../godot/scene/multiMesh';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasMeshItem } from '../../../r3f/components/CanvasMeshItem';
import { useMeshContent } from '../../../r3f/meshes/meshContent';
import { useReferencedMultiMesh } from '../../../resources/meshes/multimesh/useMultiMeshData';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import type { MultiMeshInstance2DProperties } from './types';

export function MultiMeshInstance2D({ node, children }: NodeComponentProps) {
  const props = node.properties as MultiMeshInstance2DProperties;
  const { multiMesh, resources } = useReferencedMultiMesh(props.multimesh);
  const content = useMeshContent(useResourceResolution(multiMesh?.mesh, resources));
  const draws =
    multiMesh?.transformFormat === MultiMeshTransformFormat.TRANSFORM_2D &&
    multiMesh.instances.length > 0 &&
    content.kind === 'surfaced';

  return (
    <CanvasMeshItem
      node={node}
      props={props}
      mesh={draws ? content.mesh : null}
      instances={multiMesh?.instances}
    >
      {children}
    </CanvasMeshItem>
  );
}
