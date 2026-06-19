/**
 * <AnimatedSprite2D> — plays a SpriteFrames animation as a textured quad.
 * Resolves `sprite_frames` (SubResource SpriteFrames) → the active `animation`'s
 * ordered frames + timing, then advances the displayed frame from a wall-clock
 * accumulator (the autonomous loop Godot's AnimatedSprite2D runs — independent
 * of the AnimationPlayer transport). It draws the current frame like a Sprite2D
 * (centered/offset/flip, inherited modulate via CanvasItem2D); single-frame or
 * fps-0 animations stay static on the authored `frame`. ExtResource (.tres)
 * SpriteFrames aren't resolved yet → placeholder.
 */

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { findSubResource, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { parseResourceReference, resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { parseSpriteFramesAnimations, frameAtTime, type SpriteFramesAnimation } from './spriteFrames';
import type { AnimatedSprite2DProperties } from './types';

export function AnimatedSprite2D({ node, children }: NodeComponentProps) {
  const props = node.properties as AnimatedSprite2DProperties;
  const { internalResources, externalResources } = useSceneResources();

  // The active animation (ordered frames + timing), resolved once per props.
  const animation = useMemo(
    () => resolveAnimation(props, internalResources),
    [props, internalResources]
  );
  const frameCount = animation?.frames.length ?? 0;
  const playing = frameCount > 1 && (animation?.fps ?? 0) > 0;

  // While playing, `playbackFrame` advances from an `elapsed` accumulator; while
  // not playing (single-frame / fps-0) the authored `props.frame` is shown
  // directly, so a live `.tscn` edit to `frame` stays reactive. playbackFrame
  // seeds from the authored frame so a not-yet-ticked playing sprite shows the
  // authored pose; an out-of-range index self-corrects on the next tick.
  const [playbackFrame, setPlaybackFrame] = useState(props.frame);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!playing || !animation) return;
    elapsed.current += delta;
    const next = frameAtTime(animation, elapsed.current);
    setPlaybackFrame((prev) => (prev === next ? prev : next));
  });

  // Godot clamps an out-of-range `frame` to the last frame rather than blanking.
  const rawFrame = playing ? playbackFrame : props.frame;
  const frame = frameCount > 0 ? Math.min(Math.max(rawFrame, 0), frameCount - 1) : 0;
  const frameRef = animation?.frames[frame] ?? null;
  const texturePath = useMemo(
    () => resolveExtResourcePath(frameRef, externalResources),
    [frameRef, externalResources]
  );
  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');

  const showPlaceholder = !texturePath || texResult.status === 'unavailable';

  const tex = texResult.value;
  const image = tex?.image as { width?: number; height?: number } | undefined;
  const width = image?.width ?? 1;
  const height = image?.height ?? 1;
  const cgx = props.offset.x + (props.centered ? 0 : width / 2);
  const cgy = props.offset.y + (props.centered ? 0 : height / 2);
  const meshScale: [number, number, number] = [props.flip_h ? -1 : 1, props.flip_v ? -1 : 1, 1];

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }) =>
        showPlaceholder ? (
          <MissingResourcePlaceholder shape="plane" name={node.name} />
        ) : tex ? (
          <mesh position={[cgx, -cgy, 0]} scale={meshScale}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
              map={tex}
              color={color}
              opacity={opacity}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}

/** Resolve the active SpriteFrames animation (frames + timing) for this node. */
function resolveAnimation(
  props: AnimatedSprite2DProperties,
  internalResources: readonly TscnInternalResource[]
): SpriteFramesAnimation | null {
  if (!props.sprite_frames) return null;
  const parsed = parseResourceReference(props.sprite_frames);
  if (!parsed || parsed.type !== 'SubResource') return null; // .tres SpriteFrames: later
  const sf = findSubResource(internalResources, parsed.id);
  const animationsValue = (sf?.data as Record<string, unknown> | undefined)?.animations;
  if (typeof animationsValue !== 'string') return null;

  const map = parseSpriteFramesAnimations(animationsValue);
  const animName =
    props.animation && map.has(props.animation) ? props.animation : [...map.keys()][0];
  return (animName ? map.get(animName) : undefined) ?? null;
}
