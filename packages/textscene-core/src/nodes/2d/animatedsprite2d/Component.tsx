/**
 * <AnimatedSprite2D> draws a SpriteFrames animation as a textured quad, like a
 * Sprite2D. It is a selection-driven transport driver (ADR-0012), not an autonomous
 * loop: it shows the authored `frame` until the node is selected and the transport
 * plays. The pure `stepPlayback` reducer decides each frame's transport action.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { canvasItemBlendState } from '../../../resources/materials/canvasitemmaterial/renderer';
import { CanvasItemBlendMode } from '../../../resources/materials/canvasitemmaterial/types';
import { composeFrameTexture, frameSizePx, type SpriteFrameProps } from '../../../r3f/spriteFrame';
import { useCanvasDecodeDefines } from '../../../r3f/canvas2DTextureDecode';
import { canvasItemFacing } from '../../../r3f/canvasItemFacing';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { useTexture2D } from '../../../resources/useTexture2D';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { useAnimationTransport } from '../../../r3f/contexts/AnimationTransportContext';
import { stepPlayback } from '../../../r3f/animation/stepPlayback';
import { loopsUnderOverride } from '../../../r3f/animation/loopOverride';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { useSpriteFrames } from './useSpriteFrames';
import { frameAtTime, clipDuration } from '../../../resources/textures/spriteframes/playback';
import type { SpriteFramesAnimation } from '../../../resources/textures/spriteframes/types';
import type { AnimatedSprite2DProperties } from './types';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';

/**
 * A frame is the whole of the texture it names: `useTexture2D` crops a sheet cell
 * (AtlasTexture) to its own texture, so nothing is windowed here. Module scope
 * gives the memos below one stable identity.
 */
const WHOLE_FRAME: SpriteFrameProps = {
  region_enabled: false,
  hframes: 1,
  vframes: 1,
  frame: 0,
};
const NO_EXTERNAL_RESOURCES: readonly TscnExternalResource[] = [];
const NO_INTERNAL_RESOURCES: readonly TscnInternalResource[] = [];

export function AnimatedSprite2D({ node, children }: NodeComponentProps) {
  const props = node.properties as AnimatedSprite2DProperties;

  // Every animation the SpriteFrames declares, not only the authored one: the
  // transport lets the user pick any clip.
  const { spriteFrames: resolved, status: spriteFramesStatus } = useSpriteFrames(props.sprite_frames);
  const spriteFrames = resolved?.animations ?? null;
  const clipNames = useMemo(() => (spriteFrames ? [...spriteFrames.keys()] : []), [spriteFrames]);
  const durations = useMemo(
    () =>
      spriteFrames
        ? Object.fromEntries([...spriteFrames.values()].map((a) => [a.name, clipDuration(a)]))
        : {},
    [spriteFrames]
  );

  // This sprite owns the transport only while it is the node selected in the tree.
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
  // playing/paused. When stopped the authored `props.frame` is shown directly.
  const [playbackFrame, setPlaybackFrame] = useState(0);
  const { time: transportTime, reportTime } = transport;
  // AnimatedSprite2D has no THREE action to read the live playhead from, so it
  // keeps its own clock. The reducer's `resume` flag re-seeds it from the transport
  // on a fresh play entry and on a clip switch.
  const prevStateRef = useRef(effectiveState);
  const prevAnimRef = useRef<string | null>(null);
  const prevTimeRef = useRef(0);
  const lastPlayingTimeRef = useRef(0);

  useFrame((_, delta) => {
    if (!currentAnim) return;

    const step = stepPlayback({
      prevState: prevStateRef.current,
      state: effectiveState,
      prevTime: prevTimeRef.current,
      transportTime,
      liveTime: lastPlayingTimeRef.current,
      // Treat an animation change as a "clip changed" so resume fires.
      clipChanged: currentAnim.name !== prevAnimRef.current,
    });

    // Pause-edge flush. `liveTime` is always a number here, though
    // `stepPlayback` also accepts null.
    if (step.flushTime) {
      reportTime(lastPlayingTimeRef.current, { immediate: true });
    }

    switch (step.command) {
      case 'ensure-playing': {
        const dur = clipDuration(currentAnim);
        // Re-seed the local clock on a fresh entry into playing or a clip switch.
        const base = step.resume ? transportTime : lastPlayingTimeRef.current;
        // The preview Speed multiplier and Loop override apply as in the mixer
        // drivers (loopsUnderOverride mirrors applyLoopOverride). A repeating clip
        // wraps past its end, and a non-repeating one holds its last frame.
        const s = delta * transport.playbackSpeed;
        const loops = loopsUnderOverride(transport.loopOverride, currentAnim.loop);
        const t = dur > 0 && loops ? (base + s) % dur : Math.min(base + s, dur);
        reportTime(t);
        lastPlayingTimeRef.current = t;
        // frameAtTime reads the animation's own loop flag, so it gets the
        // override-effective flag, not the authored one.
        const effectiveAnim = loops === currentAnim.loop ? currentAnim : { ...currentAnim, loop: loops };
        const next = frameAtTime(effectiveAnim, t);
        setPlaybackFrame((prev) => (prev === next ? prev : next));
        break;
      }
      case 'seek':
      case 'hold-paused': {
        // Paused: with no THREE action to hold, "hold" and "seek" are the same
        // frame lookup at the transport time.
        const next = frameAtTime(currentAnim, transportTime);
        setPlaybackFrame((prev) => (prev === next ? prev : next));
        break;
      }
      case 'stop-and-restore':
      case 'none': {
        // Stopped: the authored props.frame shows below, so nothing drives here.
        break;
      }
    }

    prevStateRef.current = effectiveState;
    prevAnimRef.current = currentAnim.name;
    prevTimeRef.current = transportTime;
  });

  const frameCount = currentAnim?.frames.length ?? 0;
  const rawFrame = effectiveState === 'stopped' ? props.frame : playbackFrame;
  // Godot clamps an out-of-range frame to the last rather than blanking.
  const frame = frameCount > 0 ? Math.min(Math.max(rawFrame, 0), frameCount - 1) : 0;
  const frameRef = currentAnim?.frames[frame] ?? null;

  // A frame's ids are scoped to its SpriteFrames' home, so the frame resolves
  // against those pools: the scene's, or the .tres's.
  const { texture: frameTexture, missing: frameMissing } = useTexture2D(
    frameRef ?? undefined,
    resolved?.externalResources ?? NO_EXTERNAL_RESOURCES,
    resolved?.subResources ?? NO_INTERNAL_RESOURCES
  );

  // composeFrameTexture clones per frame, as sampler state is per consumer. The
  // prior clone is disposed on advance and unmount, so playback leaks no GPU texture.
  // NoColorSpace: the 2D canvas's filter blends undecoded sRGB bytes
  // (`canvas2DTextureDecode.ts`), and `useCanvasDecodeDefines` decodes the sample.
  const displayedTexture = useMemo(
    () => composeFrameTexture(frameTexture ?? undefined, WHOLE_FRAME, 'clamp', THREE.NoColorSpace),
    [frameTexture]
  );
  useEffect(() => () => displayedTexture?.dispose(), [displayedTexture]);
  const decodeDefines = useCanvasDecodeDefines(displayedTexture);
  const { width, height } = useMemo(
    () => frameSizePx(frameTexture ?? undefined, WHOLE_FRAME),
    [frameTexture]
  );

  // A `.tres` SpriteFrames still loading renders nothing, as Sprite2D does. The
  // placeholder is for an absent or failed resource.
  const showPlaceholder = spriteFramesStatus !== 'pending' && (!frameRef || frameMissing);

  const cgx = props.offset.x + (props.centered ? 0 : width / 2);
  const cgy = props.offset.y + (props.centered ? 0 : height / 2);
  const meshScale: [number, number, number] = [props.flip_h ? -1 : 1, props.flip_v ? -1 : 1, 1];

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }, material, lighting) => {
        if (showPlaceholder) return <MissingResourcePlaceholder shape="plane" name={node.name} />;
        if (!displayedTexture) return null;

        // Constant while a clip plays, since each frame's clone decodes alike, so
        // this remounts when the map appears, not per frame.
        const program = materialProgramInputs({
          props: {
            map: displayedTexture,
            color,
            opacity,
            transparent: true,
            depthWrite: false,
            defines: decodeDefines,
          },
          merge: [
            canvasItemFacing(),
            canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX),
            lighting,
          ],
        });

        return (
          <mesh position={[cgx, -cgy, 0]} scale={meshScale}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial key={program.key} {...program.props} />
          </mesh>
        );
      }}
    >
      {children}
    </CanvasItem2D>
  );
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
