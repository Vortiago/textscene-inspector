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
import { useCanvasLighting2D } from '../../../r3f/lighting2d/CanvasLighting2D';
import type { CanvasClip } from '../../../r3f/lighting2d/lightPassHost';
import {
  canvasGroupRectTag,
  registerCanvasGroup,
  type CanvasGroupWindow,
} from '../../../r3f/canvasGroup/canvasGroupPass';
import { rect2Grow, type Rect2 } from '../../../godot/math/rect2';
import type { Rgba } from '../../../godot/math/math';
import type { CanvasItemMaterialProperties } from '../../../resources/materials/canvasitemmaterial/types';
import { compositeRect } from './compositeRect';
import { canvasPixelRect, clipPixelRect, worldBoxOfCanvasPixels } from './canvasPixels';
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

  const clip = useClip();
  const composite = useRef<THREE.Mesh>(null);
  const plain = useRef<THREE.Mesh>(null);
  const readsBuffer = material === null;
  // The rect an enclosing group merges in the same frame: one box per group, so no two groups share it.
  const clearedRect = useMemo(() => new THREE.Box3(), []);
  useLayoutEffect(
    () =>
      registerCanvasGroup(scene, {
        window,
        buffer: readsBuffer ? buffer : null,
        fit: (drawn, nested, frameClip) => {
          if (composite.current) composite.current.visible = false;
          if (plain.current) plain.current.visible = false;
          // A canvas with no light pass, such as an inline SubViewport's, takes the frame's own clip.
          const framed = clip.current ?? frameClip;
          const pixels = framed && fittedRect(drawn, framed, frameClip, fitMargin);
          if (!pixels) return null;
          const shown = nested || !readsBuffer ? plain.current : composite.current;
          if (shown) placeRect(shown, worldBoxOfCanvasPixels(pixels, framed, shownRectBox));
          return worldBoxOfCanvasPixels(rect2Grow(pixels, clearMargin), framed, clearedRect);
        },
      }),
    [scene, window, buffer, readsBuffer, clip, fitMargin, clearMargin, clearedRect]
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

/** The clip of this canvas, as its light pass last framed it. */
function useClip(): { current: CanvasClip | null } {
  const clip = useRef<CanvasClip | null>(null);
  const { registerPassStep } = useCanvasLighting2D();
  useLayoutEffect(
    () =>
      registerPassStep((_camera, framed) => {
        clip.current = framed;
      }),
    [registerPassStep]
  );
  return clip;
}

/** The composite rect over `drawn`, in canvas pixels, or null when the group draws nothing. */
function fittedRect(
  drawn: readonly THREE.Box3[],
  clip: CanvasClip,
  frameClip: CanvasClip | null,
  fitMargin: number
): Rect2 | null {
  return compositeRect(
    drawn.map((box) => canvasPixelRect(box, clip)),
    shownPixelRect(clip, frameClip),
    fitMargin
  );
}

const shownBox = new THREE.Box3();

/** The world box `placeRect` reads at once, shared by every group. */
const shownRectBox = new THREE.Box3();

/**
 * The part of the canvas the frame shows, in `clip`'s pixels, which lists the items the group
 * fits. It is the clip in a SubViewport. The root stage shows a panned view past Godot's viewport,
 * and an item there draws as it does outside any group.
 */
function shownPixelRect(clip: CanvasClip, frameClip: CanvasClip | null): Rect2 {
  if (!frameClip) return clipPixelRect(clip);
  const { x, y, w, h } = frameClip.rect;
  shownBox.min.set(x, y, 0);
  shownBox.max.set(x + w, y + h, 0);
  return canvasPixelRect(shownBox, clip);
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
