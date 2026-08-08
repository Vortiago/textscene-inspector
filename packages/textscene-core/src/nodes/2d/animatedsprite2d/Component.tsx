/**
 * <AnimatedSprite2D> — draws a SpriteFrames animation as a textured quad.
 *
 * Like Godot's editor (and our AnimationPlayer / GLB drivers, ADR-0012), it is a
 * selection-driven transport driver, NOT an autonomous loop: by default it shows
 * the authored `frame` statically. Select the node and the Animation dock lists
 * its SpriteFrames clips; play/pause/scrub then advances the displayed frame from
 * the transport playhead (`frameAtTime` maps time → frame — no THREE mixer). It
 * draws the current frame like a Sprite2D (centered/offset/flip, inherited
 * modulate via CanvasItem2D). The SpriteFrames may be embedded (SubResource) or
 * an external `.tres` (ExtResource); a frame is an ordinary Texture2D reference
 * resolved against whichever of those two homes the SpriteFrames came from —
 * `useSpriteFrames` for the pools, `useTexture2D` for the texture, so a sheet
 * cell (AtlasTexture) arrives here already windowed, at the cell's own size.
 *
 * The per-frame transport-actuation decision is delegated to the pure
 * `stepPlayback` reducer; this component is a thin adapter that actuates the
 * returned command on its local time accumulator and `frameAtTime` lookup.
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
import { useTexture2D } from '../../../resources/useTexture2D';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { useAnimationTransport } from '../../../r3f/contexts/AnimationTransportContext';
import { stepPlayback } from '../../../r3f/animation/stepPlayback';
import { loopsUnderOverride } from '../../../r3f/animation/loopOverride';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { useSpriteFrames } from './useSpriteFrames';
import { frameAtTime, clipDuration, type SpriteFramesAnimation } from './spriteFrames';
import type { AnimatedSprite2DProperties } from './types';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';

/**
 * A frame is the whole of whatever texture it names — a sheet cell arrives as
 * its own texture, cropped by the resolver, so nothing is windowed here.
 * Module-scope so the memos below see one stable identity.
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

  // All animations the SpriteFrames declares — the transport lets the user pick
  // any clip, so we resolve the whole map (not just the authored one). The
  // SpriteFrames itself may be embedded (SubResource) or an external `.tres`.
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
  // The local time accumulator: unlike the mixer drivers, AnimatedSprite2D has
  // no THREE action to read the live playhead from, so it maintains its own
  // clock. Re-seeded from the transport on fresh play entry (resume) and clip
  // switch — the `continuing` logic folds into the reducer's `resume` flag.
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

    // Pause-edge flush: the adapter guards the null (liveTime is always
    // a number here, but the contract is clear).
    if (step.flushTime) {
      reportTime(lastPlayingTimeRef.current, { immediate: true });
    }

    switch (step.command) {
      case 'ensure-playing': {
        const dur = clipDuration(currentAnim);
        // Re-seed the local clock on fresh (re)entry into playing OR clip switch.
        // `resume` from the reducer folds in the former `continuing` logic.
        const base = step.resume ? transportTime : lastPlayingTimeRef.current;
        // The preview Speed multiplier and Loop override apply to this driver
        // exactly like the mixer drivers (loopsUnderOverride mirrors
        // applyLoopOverride). Wrap a repeating clip past its end; hold a
        // non-repeating one at its last frame.
        const s = delta * transport.playbackSpeed;
        const loops = loopsUnderOverride(transport.loopOverride, currentAnim.loop);
        const t = dur > 0 && loops ? (base + s) % dur : Math.min(base + s, dur);
        reportTime(t);
        lastPlayingTimeRef.current = t;
        // frameAtTime consults the anim's OWN loop flag (wrap vs clamp at the
        // end), so hand it the override-effective flag, not the authored one.
        const effectiveAnim = loops === currentAnim.loop ? currentAnim : { ...currentAnim, loop: loops };
        const next = frameAtTime(effectiveAnim, t);
        setPlaybackFrame((prev) => (prev === next ? prev : next));
        break;
      }
      case 'seek':
      case 'hold-paused': {
        // Paused: sample the transport time either way — with no THREE action
        // to hold, "hold" and "seek" collapse to the same frame lookup.
        const next = frameAtTime(currentAnim, transportTime);
        setPlaybackFrame((prev) => (prev === next ? prev : next));
        break;
      }
      case 'stop-and-restore':
      case 'none': {
        // stopped: the authored frame is shown below via props.frame — nothing to drive here.
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

  // Resolve the current frame against the SpriteFrames' OWN resource pools (the
  // scene's, or the .tres's — a frame's ids are scoped to its home).
  const { texture: frameTexture, missing: frameMissing } = useTexture2D(
    frameRef ?? undefined,
    resolved?.externalResources ?? NO_EXTERNAL_RESOURCES,
    resolved?.subResources ?? NO_INTERNAL_RESOURCES
  );

  // composeFrameTexture clones per frame (sampler state is per consumer);
  // dispose the prior clone on advance (and unmount) so playback doesn't leak
  // one GPU texture per keyframe.
  // NoColorSpace: the 2D canvas's hardware filter blends undecoded sRGB bytes
  // (`canvas2DTextureDecode.ts`); the material below decodes the
  // already-filtered sample via `useCanvasDecodeDefines`.
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

  // While an external `.tres` SpriteFrames is still loading, render nothing
  // rather than the missing-resource placeholder (matches Sprite2D's pending
  // UX); the placeholder is for genuinely-absent/failed resources.
  const showPlaceholder = spriteFramesStatus !== 'pending' && (!frameRef || frameMissing);

  const cgx = props.offset.x + (props.centered ? 0 : width / 2);
  const cgy = props.offset.y + (props.centered ? 0 : height / 2);
  const meshScale: [number, number, number] = [props.flip_h ? -1 : 1, props.flip_v ? -1 : 1, 1];

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }, material, lighting) =>
        showPlaceholder ? (
          <MissingResourcePlaceholder shape="plane" name={node.name} />
        ) : displayedTexture ? (
          <mesh position={[cgx, -cgy, 0]} scale={meshScale}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
              map={displayedTexture}
              color={color}
              opacity={opacity}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              defines={decodeDefines}
              {...canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX)}
              {...lighting}
            />
          </mesh>
        ) : null
      }
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
