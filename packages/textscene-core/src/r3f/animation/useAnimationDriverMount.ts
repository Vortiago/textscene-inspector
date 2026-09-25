/**
 * The mount lifecycle of a clip-owning driver, AnimationPlayer or GLB. Each
 * Component keeps its clip construction, mixer root, pose snapshot and
 * `usePlaybackLoop` call. AnimationTree owns no clips, so it does not use this.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import { AnimationMixer, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import { useAnimationTransport } from '../contexts/AnimationTransportContext';
import { useRegisterDriver } from '../contexts/AnimationDriverContext';

export interface UseAnimationDriverMountParams {
  /**
   * The object the AnimationMixer is rooted on. Null while loading (async
   * arrival). Once non-null and stable, the mixer is built whenever the driver
   * is active and clips are available.
   */
  object: Object3D | null;
  /** Ready-to-play clips the driver owns (built by the caller). */
  clips: AnimationClip[];
  /** This driver's node path in the scene tree; null outside a NodePathProvider. */
  nodePath: string | null;
  /**
   * Whether this driver is the selected node. When false, the transport is not
   * registered and no mixer is built unless `buildMixer` says so.
   */
  isActive: boolean;
  /**
   * Whether to build the mixer, when narrower than `isActive`, its default. Godot
   * lists an inactive player's clips, and an AnimationTree follows its own flag
   * (ADR-0019), but that player's `seek_internal` refuses every scrub
   * (animation_player.cpp:664): a mixer's bindings, interpolants and pose snapshot go unused.
   */
  buildMixer?: boolean;
  /**
   * Clip name to pre-select when the driver registers with the transport
   * (`autoplay` in Godot terms). Passed through to `registerPlayer`.
   */
  autoplay?: string;
  /** Clip name → duration in seconds, for the transport's scrubber. */
  durations: Record<string, number>;
  /**
   * Called once when the mixer is built, with the object it is rooted on:
   * the driver takes its pose snapshot here, after all mixer state is ready.
   */
  onMixerBuilt: (object: Object3D) => void;
  /**
   * Restores the authored pose from the `onMixerBuilt` snapshot on teardown.
   * It runs after `stopAllAction`, so it wins over THREE's own binding restore.
   */
  restore: () => void;
}

export interface UseAnimationDriverMountResult {
  /** The live AnimationMixer, or null while the driver is inactive or unloaded. */
  mixerRef: MutableRefObject<AnimationMixer | null>;
  /** Map of clip name → AnimationAction, populated while the mixer is live. */
  actionsRef: MutableRefObject<Map<string, AnimationAction>>;
}

export function useAnimationDriverMount(
  params: UseAnimationDriverMountParams
): UseAnimationDriverMountResult {
  const { object, clips, nodePath, isActive, autoplay, durations, onMixerBuilt, restore } = params;
  const buildMixer = params.buildMixer ?? isActive;

  const transport = useAnimationTransport();
  const registerDriver = useRegisterDriver();

  const mixerRef = useRef<AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, AnimationAction>>(new Map());

  // Registered while selected, even with zero clips, so the Animation tab shows
  // "no animations" for an instanced driver outside the parse-time flattenedNodes.
  const { registerPlayer } = transport;
  useEffect(() => {
    if (!isActive) return;
    return registerPlayer({ clips: clips.map((c) => c.name), durations, autoplay });
  }, [isActive, clips, durations, autoplay, registerPlayer]);

  // Published whenever clips are loaded, selected or not, so an AnimationTree
  // whose `anim_player` resolves here can root its blended mixer.
  useEffect(() => {
    if (!object || clips.length === 0 || nodePath === null) return;
    return registerDriver(nodePath, { object, clips });
  }, [object, clips, nodePath, registerDriver]);

  // Built only while the driver would use one and is loaded (ADR-0012). The
  // teardown stops, then restores, so the driver's snapshot wins over THREE's
  // own binding restore.
  useEffect(() => {
    if (!buildMixer || !object || clips.length === 0) return;

    const mixer = new AnimationMixer(object);
    const actions = new Map<string, AnimationAction>();
    for (const clip of clips) {
      actions.set(clip.name, mixer.clipAction(clip));
    }

    mixerRef.current = mixer;
    actionsRef.current = actions;

    onMixerBuilt(object);

    return () => {
      mixer.stopAllAction();
      restore();
      mixerRef.current = null;
      actionsRef.current = new Map();
    };
  }, [buildMixer, object, clips, onMixerBuilt, restore]);

  return { mixerRef, actionsRef };
}
