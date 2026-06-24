/**
 * <Sprite2D> — a textured quad in 2D space. A CanvasItem2D (which carries the
 * 2D transform + modulate ritual) whose body is a `planeGeometry` sized to the
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

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { composeFrameTexture, frameSizePx } from '../../../r3f/spriteFrame';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useAnimatedValueRegistry, type ValueSetter } from '../../../r3f/contexts/AnimatedValueContext';
import { resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import type { Sprite2DProperties } from './types';

export function Sprite2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Sprite2DProperties;
  const { externalResources } = useSceneResources();

  // An active AnimationPlayer can drive this sprite's sheet `frame` (ADR-0016):
  // register a setter keyed by node path + `frame` so the player can push the
  // sampled value; `null` releases it and the authored `frame` shows again. The
  // registry carries a numeric tuple (ADR-0017) — `frame` is a 1-tuple.
  const nodePath = useNodePath();
  const valueRegistry = useAnimatedValueRegistry();
  const [animatedFrame, setAnimatedFrame] = useState<number | null>(null);
  useEffect(() => {
    if (nodePath === null) return;
    const setter: ValueSetter = (v) => setAnimatedFrame(v === null ? null : (v[0] ?? null));
    valueRegistry.register(nodePath, 'frame', setter);
    return () => valueRegistry.unregister(nodePath, 'frame', setter);
  }, [nodePath, valueRegistry]);

  const texturePath = useMemo(
    () => resolveExtResourcePath(props.texture, externalResources),
    [props.texture, externalResources]
  );
  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');

  // A driven `frame` overrides the authored `frame` AND any authored
  // `frame_coords` (in Godot the two are the same value), so the animation wins.
  const displayedTexture = useMemo(() => {
    const frameProps =
      animatedFrame !== null ? { ...props, frame: animatedFrame, frame_coords: undefined } : props;
    return composeFrameTexture(texResult.value, frameProps);
  }, [texResult.value, props, animatedFrame]);
  // composeFrameTexture clones the texture per frame; dispose the prior clone
  // when the frame advances (and on unmount) so playback doesn't leak GPU
  // textures (~one per keyframe otherwise).
  useEffect(() => () => displayedTexture?.dispose(), [displayedTexture]);
  // Quad size in pixels (1 px = 1 world unit in the 2D canvas).
  const { width, height } = useMemo(
    () => frameSizePx(texResult.value, props),
    [texResult.value, props]
  );

  // Placeholder when no texture is referenced or it failed to load.
  const showPlaceholder = !texturePath || texResult.status === 'unavailable';

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }) =>
        showPlaceholder ? (
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
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
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

