/**
 * useAnimationDriverMount — shared Driver mount for clip-owning transport drivers.
 *
 * Encodes the lifecycle by which an AnimationPlayer or GLB animation driver
 * comes online:
 *
 *  1. Register clips with the Animation transport while the driver is selected
 *     (`registerPlayer`), so the Animation tab appears and populates.
 *  2. Publish `{ object, clips }` into the AnimationDriverRegistry
 *     (`registerDriver`) whenever clips are loaded — independent of selection,
 *     so an AnimationTree whose `anim_player` resolves here can root its
 *     blended mixer even if this driver is never selected by the user.
 *  3. Build the THREE.AnimationMixer + actions map whenever the driver is
 *     selected AND the object + clips are ready (ADR-0012), or on the narrower
 *     `buildMixer` when the caller has one. Only a driver that could actually
 *     play pays the build cost; a scene full of never-selected GLBs allocates
 *     no mixer.
 *  4. On deselect/unmount: stop all actions, call the driver's `restore`
 *     callback (restores the authored pose), unregister from the registry.
 *
 * Per-driver, stays in each Component:
 *  - Clip construction (Godot Animation tracks vs ready-made glTF clips).
 *  - Mixer rooting (resolved Animation root vs the GLB object itself).
 *  - Pose snapshot + restore logic.
 *  - AnimationPlayer's AnimatedValue push lane.
 *  - The `usePlaybackLoop` call (feeds the returned refs).
 *
 * Not for AnimationTree: it owns no clips (registry consumer only); pulling it
 * in here would require a "doesn't actually own clips" parameter — a fat
 * interface trap.
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
   * Whether this driver is currently the selected node. When false the
   * transport is not registered (the Animation tab won't show for this
   * driver), and no mixer is built unless `buildMixer` says otherwise.
   */
  isActive: boolean;
  /**
   * Whether to build the mixer, when that is narrower than `isActive`.
   * Defaults to `isActive`.
   *
   * AnimationPlayer needs the two apart: Godot lists an inactive player's
   * clips, and an AnimationTree consuming them through `anim_player` is gated
   * by the TREE's own flag (ADR-0019), so registration follows selection —
   * but `AnimationMixer.active = false` means `seek_internal` refuses every
   * scrub (animation_player.cpp:664), so the mixer it would build can never be
   * evaluated. Building it anyway costs a PropertyBinding and an Interpolant
   * per track, plus the caller's pose snapshot, on every selection.
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
   * Called when the mixer is torn down (deselect or unmount): restore the
   * authored pose from the snapshot captured in `onMixerBuilt`. The hook
   * calls this after `stopAllAction` (so the snapshot wins over THREE's own
   * binding-state restore on action deactivation) and before clearing the
   * mixer ref.
   */
  restore: () => void;
}

export interface UseAnimationDriverMountResult {
  /** Live AnimationMixer ref — null while the driver is inactive or unloaded. */
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

  // 1. Register clips with the Animation transport while this driver is
  //    selected. Even with zero clips the registration must fire so the
  //    Animation tab appears (reads "no animations") for instanced drivers that
  //    never enter the parse-time flattenedNodes.
  const { registerPlayer } = transport;
  useEffect(() => {
    if (!isActive) return;
    return registerPlayer({ clips: clips.map((c) => c.name), durations, autoplay });
  }, [isActive, clips, durations, autoplay, registerPlayer]);

  // 2. Publish { object, clips } into the AnimationDriverRegistry whenever
  //    clips are loaded — independent of selection. An AnimationTree whose
  //    `anim_player` resolves here can root its blended mixer even if this
  //    driver is never selected.
  useEffect(() => {
    if (!object || clips.length === 0 || nodePath === null) return;
    return registerDriver(nodePath, { object, clips });
  }, [object, clips, nodePath, registerDriver]);

  // 3. Build the THREE.AnimationMixer + actions while the driver would use one
  //    AND is loaded, so a driver that cannot play pays no allocation cost.
  //    Teardown (deselect/unmount) is stop-then-restore, matching
  //    usePlaybackLoop's stop path: stopping first lets THREE run its own
  //    binding-state restore on action deactivation, then the driver's
  //    snapshot restore wins.
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
