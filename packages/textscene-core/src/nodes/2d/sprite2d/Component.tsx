/**
 * <Sprite2D> — a textured quad in 2D space. A Node2D (so it carries the 2D
 * transform via node2dGroupProps) whose body is a `planeGeometry` sized to the
 * texture's pixel dimensions (1 px = 1 world unit). Inside the conjugated
 * (diag(1,-1,1)) Node2D group, a Godot-local point p is placed at three-local
 * (p.x, -p.y), so the quad centre is computed in Godot 2D space (+Y down) then
 * Y-negated.
 *
 * Surface handled: texture (ExtResource), centered/offset, flip_h/flip_v
 * (mirror via mesh scale, which flips the texture too — matching Godot),
 * region_rect, hframes/vframes/frame/frame_coords sprite-sheet slicing, and the
 * CanvasItem `modulate` tint. Material is unlit (meshBasicMaterial) like Godot's
 * 2D canvas, double-sided, alpha-blended. Missing/pending texture mirrors the
 * Sprite3D UX (placeholder plane / render nothing yet).
 *
 * The region/frames UV + size math lives in the shared `r3f/spriteFrame` module
 * (one home for Sprite2D + Sprite3D). Flip handling stays here because it
 * legitimately differs: 2D mirrors via mesh scale, 3D via UV negation.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { node2dGroupProps, node2dGroupSpread, canvasItemZ } from '../../../r3f/node2dTransform';
import { Modulate2DContext, useCanvasItemTint } from '../../../r3f/canvasItemModulate';
import { composeFrameTexture, frameSizePx } from '../../../r3f/spriteFrame';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import type { Sprite2DProperties } from './types';

export function Sprite2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Sprite2DProperties;
  const { externalResources } = useSceneResources();

  const transform = useMemo(
    () => node2dGroupSpread(node2dGroupProps(props, canvasItemZ(props))),
    [props]
  );

  const texturePath = useMemo(
    () => resolveExtResourcePath(props.texture, externalResources),
    [props.texture, externalResources]
  );
  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');

  const displayedTexture = useMemo(
    () => composeFrameTexture(texResult.value, props),
    [texResult.value, props]
  );
  // Quad size in pixels (1 px = 1 world unit in the 2D canvas).
  const { width, height } = useMemo(
    () => frameSizePx(texResult.value, props),
    [texResult.value, props]
  );

  // Inherited modulate (propagates to children) + own-pixel tint (× self_modulate).
  const { inherited, color, opacity } = useCanvasItemTint(props);

  const visible = props.visible !== false;

  // Placeholder when no texture is referenced or it failed to load.
  const showPlaceholder = !texturePath || texResult.status === 'unavailable';

  return (
    <group name={node.name} {...transform} visible={visible}>
      {showPlaceholder ? (
        <MissingResourcePlaceholder shape="plane" name={node.name} />
      ) : displayedTexture ? (
        <QuadMesh
          texture={displayedTexture}
          color={color}
          opacity={opacity}
          width={width}
          height={height}
          props={props}
        />
      ) : null}
      <Modulate2DContext.Provider value={inherited}>{children}</Modulate2DContext.Provider>
    </group>
  );
}

function QuadMesh({
  texture,
  color,
  opacity,
  width,
  height,
  props,
}: {
  texture: THREE.Texture;
  color: THREE.Color;
  opacity: number;
  width: number;
  height: number;
  props: Sprite2DProperties;
}) {
  // Quad centre in Godot 2D space (+Y down), then Y-negated for the conjugated
  // group frame. centered ⇒ centre at `offset`; otherwise the quad's top-left
  // sits at `offset`, so its centre is offset + (w/2, h/2).
  const cgx = props.offset.x + (props.centered ? 0 : width / 2);
  const cgy = props.offset.y + (props.centered ? 0 : height / 2);
  const meshScale: [number, number, number] = [props.flip_h ? -1 : 1, props.flip_v ? -1 : 1, 1];

  return (
    <mesh position={[cgx, -cgy, 0]} scale={meshScale}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        color={color}
        opacity={opacity}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

