/**
 * <CanvasGroup>: a Node2D whose children at its `z_final` draw into one buffer, which a single rect
 * then composites over the canvas (`renderer_canvas_cull.cpp:196-256`). The group's `modulate`
 * reaches the children and the rect, so its alpha applies twice. Its `self_modulate` reaches the
 * rect alone.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import type { TscnNode } from '../../../parser/types';
import { Node2D } from '../../base/node2d/Component';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import type { CanvasItemPixelMaterial } from '../../../r3f/components/LitCanvasItemPixels';
import { node2dZStep, useCanvasRunKeysOfNode } from '../../../r3f/canvasItemState';
import type { CanvasItemTint } from '../../../r3f/canvasItemModulate';
import { useCanvasColorSpace, type CanvasColorSpace } from '../../../r3f/canvasColorSpace';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { createCanvasFrame } from '../../../r3f/components/Canvas2DStage/canvasFrame';
import { canvasGroupRectTag, registerCanvasGroup } from '../../../r3f/canvasGroup/canvasGroupPass';
import type { CanvasGroupWindow } from '../../../r3f/canvasGroup/groupWindow';
import type { Rgba } from '../../../godot/math/math';
import type { CanvasItemMaterialProperties } from '../../../resources/materials/canvasitemmaterial/types';
import { useGroupFit } from './useGroupFit';
import { createCompositeMaterial } from './compositeMaterial';
import type { CanvasGroupProperties } from './types';

export function CanvasGroup({ node, children }: NodeComponentProps) {
  // A y-sorted group takes the y-sort branch, which groups nothing (`renderer_canvas_cull.cpp:437-469`):
  // measured on 4.6.3, its children draw as a plain Node2D's and its `self_modulate` changes nothing.
  if ((node.properties as CanvasGroupProperties).y_sort_enabled)
    return <Node2D node={node}>{children}</Node2D>;
  return <CompositingGroup node={node}>{children}</CompositingGroup>;
}

function CompositingGroup({ node, children }: { node: TscnNode; children?: React.ReactNode }) {
  const props = node.properties as CanvasGroupProperties;
  const window = useCanvasRunKeysOfNode(node, node2dZStep(props));
  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={(tint, material, pixelMaterial) => (
        <GroupRect
          window={window}
          tint={tint}
          material={material}
          pixelMaterial={pixelMaterial}
          fitMargin={props.fit_margin}
          clearMargin={props.clear_margin}
        />
      )}
    >
      {children}
    </CanvasItem2D>
  );
}

/** A unit square at the origin, which each rect mesh scales to the fitted rect. */
const UNIT_SQUARE = new THREE.PlaneGeometry(1, 1);

interface GroupRectProps {
  window: CanvasGroupWindow;
  tint: CanvasItemTint;
  /** The CanvasItemMaterial in force, which replaces the group shader with a plain rect. */
  material: CanvasItemMaterialProperties | null;
  pixelMaterial: CanvasItemPixelMaterial;
  fitMargin: number;
  clearMargin: number;
}

/**
 * The group's rect, in two meshes of which the pass shows one each frame: the composite over the
 * buffer, or a plain rect of the group colour. A material in force draws the plain rect
 * (`renderer_canvas_render_rd.cpp:2207-2219`), and so does a group inside another group's window,
 * which Godot's renderer draws as an ordinary item (`:812-813`).
 */
function GroupRect({ window, tint, material, pixelMaterial, fitMargin, clearMargin }: GroupRectProps) {
  const scene = useThree((state) => state.scene);
  const space = useCanvasColorSpace();
  const buffer = useMemo(() => createCanvasFrame(space), [space]);
  useEffect(() => () => buffer.dispose(), [buffer]);
  const compositeMaterial = useMemo(() => createCompositeMaterial(buffer.texture), [buffer]);
  useEffect(() => () => compositeMaterial.dispose(), [compositeMaterial]);
  useLayoutEffect(() => {
    writeCompositeColour(compositeMaterial.uniforms.colour!.value as THREE.Vector4, tint.self, space);
  }, [compositeMaterial, tint.self, space]);

  const fitRect = useGroupFit({ fitMargin, clearMargin });
  const composite = useRef<THREE.Mesh>(null);
  const plain = useRef<THREE.Mesh>(null);
  const readsBuffer = material === null;
  useLayoutEffect(
    () =>
      registerCanvasGroup(scene, {
        window,
        buffer: readsBuffer ? buffer : null,
        fit: (drawn, nested, frameClip) => {
          if (composite.current) composite.current.visible = false;
          if (plain.current) plain.current.visible = false;
          const rects = fitRect(drawn, frameClip);
          if (!rects) return null;
          const shown = nested || !readsBuffer ? plain.current : composite.current;
          if (shown) placeRect(shown, rects.fitted);
          return rects.cleared;
        },
      }),
    [scene, window, buffer, readsBuffer, fitRect]
  );

  const program = materialProgramInputs({
    props: {
      color: tint.color,
      opacity: tint.opacity,
      transparent: true,
      depthWrite: false,
      defines: space.defines,
    },
    merge: [pixelMaterial],
  });
  // Hidden until the pass fits them: a canvas drawn without the pass shows no unit square.
  return (
    <>
      <mesh
        ref={composite}
        visible={false}
        geometry={UNIT_SQUARE}
        material={compositeMaterial}
        userData={canvasGroupRectTag()}
      />
      <mesh ref={plain} visible={false} geometry={UNIT_SQUARE} userData={canvasGroupRectTag()}>
        <meshBasicMaterial key={program.key} {...program.props} />
      </mesh>
    </>
  );
}

const toLocal = new THREE.Matrix4();
const localBox = new THREE.Box3();

/**
 * Shows `mesh` over the bounds, in its parent's space, of `world`: Godot draws the rect at
 * `p_transform.affine_inverse().xform(rect_accum)` (`renderer_canvas_cull.cpp:233`).
 */
function placeRect(mesh: THREE.Mesh, world: THREE.Box3): void {
  toLocal.copy(mesh.parent!.matrixWorld).invert();
  localBox.copy(world).applyMatrix4(toLocal);
  localBox.getCenter(mesh.position);
  mesh.position.z = 0;
  mesh.scale.set(localBox.max.x - localBox.min.x, localBox.max.y - localBox.min.y, 1);
  mesh.visible = true;
  // The pass draws the buffers after the scene's last matrix update.
  mesh.updateMatrixWorld();
}

/**
 * The group colour in the numbers the composite writes: sRGB in an sRGB canvas, linear in a
 * linear one, where Godot converts each modulate before it multiplies.
 */
function writeCompositeColour(out: THREE.Vector4, colour: Rgba, space: CanvasColorSpace): void {
  const { r, g, b } = space.isLinear ? godotColorToLinear(colour) : colour;
  out.set(r, g, b, colour.a);
}
