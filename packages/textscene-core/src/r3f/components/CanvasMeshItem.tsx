/**
 * A canvas item whose body is a mesh drawn on the 2D canvas, each surface at its vertices' x and y,
 * in surface order, with no depth test and no face culling. The surfaces' own materials never
 * apply: the canvas item's pipeline draws them (`renderer_canvas_render_rd.cpp:3187-3212`).
 * MeshInstance2D draws the mesh once. MultiMeshInstance2D draws it for each instance of its MultiMesh.
 * It turns the mesh into the surfaces of `CanvasMeshBody`.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import type { MultiMeshInstance } from '../../resources/meshes/multimesh';
import { useNodeReference } from '../../resources/reading';
import { useCanvasColorSpace } from '../canvasColorSpace';
import { sRGBChannelToLinear } from '../../utils/colorSpace';
import { canvasMeshGeometry } from '../meshes/canvasMeshGeometry';
import { canvasInstancesGeometry, MESH_INSTANCE } from '../meshes/canvasMeshInstances';
import type { SurfacedMesh } from '../meshes/meshContent';
import { particlesFlipbook } from '../particlesFlipbook';
import { useSceneResources } from '../SceneResourcesContext';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import { CanvasMeshBody } from '../canvasMesh/CanvasMeshBody';
import { useCanvasMeshTexture } from '../canvasMesh/useCanvasMeshTexture';
import type { CanvasSurface } from '../canvasMesh/canvasSurface';

interface CanvasMeshItemProps {
  node: TscnNode;
  /** The item's Node2D surface and its `texture` reference. */
  props: Node2DProperties & { texture?: string };
  /** The mesh to draw, or null for a node that draws nothing. Its children still draw. */
  mesh: SurfacedMesh | null;
  /** The instances to draw the mesh for, in order. Absent draws it once, as a MeshInstance2D does. */
  instances?: readonly MultiMeshInstance[];
  children?: ReactNode;
}

export function CanvasMeshItem({ node, props, mesh, instances, children }: CanvasMeshItemProps) {
  const scope = useSceneResources();
  const texture = useCanvasMeshTexture(props, { reference: useNodeReference(props.texture, scope) });
  const surfaces = useMemo(
    () => mesh && { input: { mesh, instances }, useSurfaces: useMeshSurfaces },
    [mesh, instances]
  );
  return (
    <CanvasMeshBody node={node} props={props} texture={texture} withoutTexture="white" surfaces={surfaces}>
      {children}
    </CanvasMeshBody>
  );
}

/**
 * A surface for each part of `mesh`, released when it changes or the node unmounts. A mesh drawn
 * once with no flipbook shares the source buffers. Any other draw builds its own copy, whose vertex
 * colours a linear canvas decodes before the instance colours multiply.
 */
function useMeshSurfaces(
  { mesh, instances }: { mesh: SurfacedMesh; instances: readonly MultiMeshInstance[] | undefined },
  material: CanvasItemMaterialProperties | null
): readonly CanvasSurface[] {
  // Stable per material: a new object each render would rebuild the merged geometry.
  const flipbook = useMemo(() => particlesFlipbook(material), [material]);
  const canvasSpace = useCanvasColorSpace();
  const surfaces = useMemo(() => {
    const drawn = instances ?? (flipbook ? [MESH_INSTANCE] : null);
    const decode = canvasSpace.isLinear ? sRGBChannelToLinear : undefined;
    return mesh.parts.map(({ geometry }): CanvasSurface =>
      drawn
        ? { geometry: canvasInstancesGeometry(geometry, drawn, flipbook, decode), vertexColors: 'instance' }
        : { geometry: canvasMeshGeometry(geometry) }
    );
  }, [mesh, instances, flipbook, canvasSpace]);
  const disposable = useMemo(
    () => ({ dispose: () => surfaces.forEach(({ geometry }) => geometry.dispose()) }),
    [surfaces]
  );
  useDisposeOnRelease(disposable);
  return surfaces;
}
