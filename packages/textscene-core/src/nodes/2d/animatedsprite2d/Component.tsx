/**
 * <AnimatedSprite2D> — draws a SpriteFrames animation as a textured quad.
 *
 * Like Godot's editor (and our AnimationPlayer / GLB drivers, ADR-0012), it is a
 * selection-driven transport driver, NOT an autonomous loop: by default it shows
 * the authored `frame` statically. Select the node and the Animation dock lists
 * its SpriteFrames clips; play/pause/scrub then advances the displayed frame from
 * the transport playhead (`frameAtTime` maps time → frame — no THREE mixer). It
 * draws the current frame like a Sprite2D (centered/offset/flip, inherited
 * modulate via CanvasItem2D). ExtResource (.tres) SpriteFrames aren't resolved
 * yet → placeholder.
 */

import { useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { findSubResource, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { parseResourceReference, resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { useAnimationTransport } from '../../../r3f/contexts/AnimationTransportContext';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import {
  parseSpriteFramesAnimations,
  frameAtTime,
  clipDuration,
  type SpriteFramesAnimation,
} from './spriteFrames';
import type { AnimatedSprite2DProperties } from './types';

export function AnimatedSprite2D({ node, children }: NodeComponentProps) {
  const props = node.properties as AnimatedSprite2DProperties;
  const { internalResources, externalResources } = useSceneResources();

  // All animations the SpriteFrames declares — the transport lets the user pick
  // any clip, so we resolve the whole map (not just the authored one).
  const spriteFrames = useMemo(
    () => resolveSpriteFrames(props, internalResources),
    [props, internalResources]
  );
  const clipNames = useMemo(() => (spriteFrames ? [...spriteFrames.keys()] : []), [spriteFrames]);
  const durations = useMemo(
    () =>
      spriteFrames
        ? Object.fromEntries([...spriteFrames.values()].map((a) => [a.name, clipDuration(a)]))
        : {},
    [spriteFrames]
  );

  // Selection-driven (ADR-0012): this sprite owns the transport only while it is
  // the node selected in the tree.
  const transport = useAnimationTransport();
  const nodePath = useNodePath();
  const selectedNodePath = useOptionalSelection()?.selectedNodePath ?? null;
  const isActive = nodePath !== null && nodePath === selectedNodePath;

  // Register this sprite's clips with the transport while selected, so the
  // Animation tab lists them (the authored `animation` pre-selects).
  const { registerPlayer } = transport;
  useEffect(() => {
    if (!isActive || !spriteFrames) return;
    return registerPlayer({ clips: clipNames, durations, autoplay: props.animation || undefined });
  }, [isActive, spriteFrames, clipNames, durations, props.animation, registerPlayer]);

  // The clip to display: the transport's selected clip while active, else the
  // authored `animation` (so an unselected/static sprite shows its own clip).
  const effectiveState = isActive ? transport.playState : 'stopped';
  const currentAnim = pickAnimation(spriteFrames, isActive ? transport.selectedClip : props.animation);

  // Playback advances `playbackFrame` from the transport playhead while
  // playing/paused; when stopped the authored `props.frame` is shown directly.
  const [playbackFrame, setPlaybackFrame] = useState(0);
  const { time: transportTime, reportTime } = transport;
  useFrame((_, delta) => {
    if (!currentAnim) return;
    if (effectiveState === 'playing') {
      const dur = clipDuration(currentAnim);
      // Wrap a looping clip past its end; hold a one-shot at its last frame.
      const t = dur > 0 && currentAnim.loop ? (transportTime + delta) % dur : Math.min(transportTime + delta, dur);
      reportTime(t);
      const next = frameAtTime(currentAnim, t);
      setPlaybackFrame((prev) => (prev === next ? prev : next));
    } else if (effectiveState === 'paused') {
      const next = frameAtTime(currentAnim, transportTime); // sample the seeked time
      setPlaybackFrame((prev) => (prev === next ? prev : next));
    }
    // stopped: the authored frame is shown below — nothing to drive here.
  });

  const frameCount = currentAnim?.frames.length ?? 0;
  const rawFrame = effectiveState === 'stopped' ? props.frame : playbackFrame;
  // Godot clamps an out-of-range frame to the last rather than blanking.
  const frame = frameCount > 0 ? Math.min(Math.max(rawFrame, 0), frameCount - 1) : 0;
  const frameRef = currentAnim?.frames[frame] ?? null;
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

/** Resolve the SpriteFrames SubResource into its full name → animation map. */
function resolveSpriteFrames(
  props: AnimatedSprite2DProperties,
  internalResources: readonly TscnInternalResource[]
): Map<string, SpriteFramesAnimation> | null {
  if (!props.sprite_frames) return null;
  const parsed = parseResourceReference(props.sprite_frames);
  if (!parsed || parsed.type !== 'SubResource') return null; // .tres SpriteFrames: later
  const sf = findSubResource(internalResources, parsed.id);
  const animationsValue = (sf?.data as Record<string, unknown> | undefined)?.animations;
  if (typeof animationsValue !== 'string') return null;
  const map = parseSpriteFramesAnimations(animationsValue);
  return map.size > 0 ? map : null;
}

/** Pick the named animation, falling back to the first declared one. */
function pickAnimation(
  map: Map<string, SpriteFramesAnimation> | null,
  name: string | null | undefined
): SpriteFramesAnimation | null {
  if (!map) return null;
  if (name && map.has(name)) return map.get(name)!;
  return [...map.values()][0] ?? null;
}
