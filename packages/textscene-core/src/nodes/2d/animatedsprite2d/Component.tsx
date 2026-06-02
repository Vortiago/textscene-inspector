/**
 * <AnimatedSprite2D> — renders the current animation's current frame as a
 * static textured quad (no playback in V1). Resolves `sprite_frames`
 * (SubResource SpriteFrames) → its `animations` map → the texture for
 * `animation`/`frame`, then draws it like a Sprite2D (centered/offset/flip,
 * inherited modulate). ExtResource (.tres) SpriteFrames aren't resolved yet →
 * placeholder.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { node2dGroupProps, Z_INDEX_STEP } from '../../../r3f/node2dTransform';
import { Modulate2DContext, multiplyModulate, useParentModulate } from '../../../r3f/canvasItemModulate';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { parseSpriteFramesAnimations } from './spriteFrames';
import type { AnimatedSprite2DProperties } from './types';

export function AnimatedSprite2D({ node, children }: NodeComponentProps) {
  const props = node.properties as AnimatedSprite2DProperties;
  const { internalResources, externalResources } = useSceneResources();

  const group = useMemo(() => node2dGroupProps(props, props.z_index * Z_INDEX_STEP), [props]);
  const parentModulate = useParentModulate();
  const modulate = useMemo(
    () => multiplyModulate(parentModulate, props.modulate),
    [parentModulate, props.modulate]
  );

  const frameRef = useMemo(
    () => resolveFrameTextureRef(props, internalResources),
    [props, internalResources]
  );
  const texturePath = useMemo(
    () => resolveTexturePath(frameRef, externalResources),
    [frameRef, externalResources]
  );
  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');

  const color = useMemo(
    () => new THREE.Color(modulate.r, modulate.g, modulate.b),
    [modulate.r, modulate.g, modulate.b]
  );
  const visible = props.visible !== false;
  const showPlaceholder = !texturePath || texResult.status === 'unavailable';

  const tex = texResult.value;
  const image = tex?.image as { width?: number; height?: number } | undefined;
  const width = image?.width ?? 1;
  const height = image?.height ?? 1;
  const cgx = props.offset.x + (props.centered ? 0 : width / 2);
  const cgy = props.offset.y + (props.centered ? 0 : height / 2);
  const meshScale: [number, number, number] = [props.flip_h ? -1 : 1, props.flip_v ? -1 : 1, 1];

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
      ) : tex ? (
        <mesh position={[cgx, -cgy, 0]} scale={meshScale}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            map={tex}
            color={color}
            opacity={modulate.a}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      <Modulate2DContext.Provider value={modulate}>{children}</Modulate2DContext.Provider>
    </group>
  );
}

/** Resolve the texture ref for the current animation + frame from the SpriteFrames sub-resource. */
function resolveFrameTextureRef(
  props: AnimatedSprite2DProperties,
  internalResources: readonly TscnInternalResource[]
): string | null {
  if (!props.sprite_frames) return null;
  const parsed = parseResourceReference(props.sprite_frames);
  if (!parsed || parsed.type !== 'SubResource') return null; // .tres SpriteFrames: later
  const sf = internalResources.find((r) => r.id === parsed.id);
  const animationsValue = (sf?.data as Record<string, unknown> | undefined)?.animations;
  if (typeof animationsValue !== 'string') return null;

  const map = parseSpriteFramesAnimations(animationsValue);
  const animName =
    props.animation && map.has(props.animation) ? props.animation : [...map.keys()][0];
  if (!animName) return null;
  const frames = map.get(animName) ?? [];
  return frames[props.frame] ?? frames[0] ?? null;
}

function resolveTexturePath(
  ref: string | null,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (!ref) return null;
  if (ref.startsWith('res://')) return ref;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  return externalResources.find((r) => r.id === parsed.id)?.path ?? null;
}
