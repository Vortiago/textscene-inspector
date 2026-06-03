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
 * The UV + size helpers intentionally mirror Sprite3D's (only two consumers —
 * under the Rule of Three; extract to a shared module if a third appears).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TscnExternalResource } from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { node2dGroupProps, canvasItemZ } from '../../../r3f/node2dTransform';
import { Modulate2DContext, useCanvasItemTint } from '../../../r3f/canvasItemModulate';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import type { Sprite2DProperties } from './types';

export function Sprite2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Sprite2DProperties;
  const { externalResources } = useSceneResources();

  const group = useMemo(
    () => node2dGroupProps(props, canvasItemZ(props)),
    [props]
  );

  const texturePath = useMemo(
    () => resolveTexturePath(props.texture, externalResources),
    [props.texture, externalResources]
  );
  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');

  const displayedTexture = useMemo(
    () => composeTexture(texResult.value, props),
    [texResult.value, props]
  );
  const { width, height } = useMemo(
    () => computeQuadSize(texResult.value, props),
    [texResult.value, props]
  );

  // Inherited modulate (propagates to children) + own-pixel tint (× self_modulate).
  const { inherited, color, opacity } = useCanvasItemTint(props);

  const visible = props.visible !== false;

  // Placeholder when no texture is referenced or it failed to load.
  const showPlaceholder = !texturePath || texResult.status === 'unavailable';

  return (
    <group
      name={node.name}
      position={group.position}
      rotation={group.rotation}
      scale={group.scale}
      visible={visible}
    >
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

function resolveTexturePath(
  textureRef: string | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (!textureRef) return null;
  if (textureRef.startsWith('res://')) return textureRef;
  const parsed = parseResourceReference(textureRef);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  const ext = externalResources.find((r) => r.id === parsed.id);
  return ext?.path ?? null;
}

/** Clone + apply region_rect or sprite-sheet UV (clone avoids clobbering shared textures). */
function composeTexture(
  texture: THREE.Texture | undefined,
  props: Sprite2DProperties
): THREE.Texture | undefined {
  if (!texture) return undefined;
  const cloned = texture.clone();
  cloned.wrapS = THREE.RepeatWrapping;
  cloned.wrapT = THREE.RepeatWrapping;

  // Godot computes base_rect (region when enabled, else full texture) THEN
  // subdivides it by hframes/vframes — the two compose, they are not exclusive.
  if (props.region_enabled && props.region_rect) {
    applyRegionRect(cloned, props.region_rect);
  }
  if (props.hframes > 1 || props.vframes > 1) {
    applySpritesheetUV(cloned, props);
  }
  cloned.needsUpdate = true;
  return cloned;
}

function applySpritesheetUV(texture: THREE.Texture, props: Sprite2DProperties): void {
  const H = Math.max(1, props.hframes);
  const V = Math.max(1, props.vframes);
  let col: number;
  let row: number;
  if (props.frame_coords) {
    col = props.frame_coords.x;
    row = props.frame_coords.y;
  } else {
    col = props.frame % H;
    row = Math.floor(props.frame / H);
  }
  // Compose over the base UV already on the texture: identity (full image) or the
  // region rect applied above. Multiplying keeps region + frames additive.
  const baseRepeatX = texture.repeat.x;
  const baseRepeatY = texture.repeat.y;
  const baseOffsetX = texture.offset.x;
  const baseOffsetY = texture.offset.y;
  texture.repeat.set(baseRepeatX / H, baseRepeatY / V);
  texture.offset.set(
    baseOffsetX + col * (baseRepeatX / H),
    baseOffsetY + baseRepeatY - (row + 1) * (baseRepeatY / V)
  );
}

function applyRegionRect(
  texture: THREE.Texture,
  rect: { x: number; y: number; width: number; height: number }
): void {
  const image = texture.image as { width?: number; height?: number } | undefined;
  if (!image?.width || !image.height) return;
  texture.repeat.set(rect.width / image.width, rect.height / image.height);
  texture.offset.set(rect.x / image.width, 1 - (rect.y + rect.height) / image.height);
}

/** Quad pixel dimensions (1 px = 1 unit): region rect, then sprite-sheet cell, else full image. */
function computeQuadSize(
  texture: THREE.Texture | undefined,
  props: Sprite2DProperties
): { width: number; height: number } {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  const imgW = image?.width ?? 1;
  const imgH = image?.height ?? 1;

  const H = Math.max(1, props.hframes);
  const V = Math.max(1, props.vframes);
  if (props.region_enabled && props.region_rect && image?.width && image.height) {
    return { width: props.region_rect.width / H, height: props.region_rect.height / V };
  }
  if (props.hframes > 1 || props.vframes > 1) {
    return { width: imgW / H, height: imgH / V };
  }
  return { width: imgW, height: imgH };
}
