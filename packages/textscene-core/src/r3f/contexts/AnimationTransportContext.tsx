/**
 * Scene-level animation transport — the single source of truth for
 * play/pause/scrub, shared between the in-canvas AnimationPlayer Component
 * (which owns the THREE.AnimationMixer) and the DOM Animation dock tab.
 *
 * Starts STOPPED so a freshly loaded scene shows its authored pose (ADR-0011 /
 * CONTEXT "Animation transport"); play is user-initiated. Slice-1 tracks a
 * single registered player; multi-player is deferred.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type PlayState = 'stopped' | 'playing' | 'paused';

export interface PlayerRegistration {
  /** Clip names the player owns, in authored order. */
  clips: string[];
  /** Clip name → duration in seconds. */
  durations: Record<string, number>;
  /** Clip to pre-select on registration (`autoplay`); falls back to the first. */
  autoplay?: string;
}

export interface AnimationTransport {
  clips: string[];
  selectedClip: string | null;
  /** The player's `autoplay` clip, if any — marked in the selector. */
  autoplayClip: string | null;
  /**
   * True while an AnimationPlayer is registered (selected). Drives Animation
   * tab visibility — works for instanced players that aren't in the parse-time
   * `flattenedNodes`, since registration is the render-time source of truth.
   */
  hasPlayer: boolean;
  playState: PlayState;
  /** Playhead position in seconds. */
  time: number;
  /** Duration of the selected clip (0 when none). */
  duration: number;
  /** Register the scene's AnimationPlayer; returns an unregister cleanup. */
  registerPlayer(registration: PlayerRegistration): () => void;
  play(): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  selectClip(name: string): void;
  /** Component → transport: report the live playhead for the scrubber. */
  reportTime(time: number): void;
}

const RESET_CLIP = 'RESET';

/** Default selection: autoplay → first non-RESET → first clip → none. */
function defaultClip(reg: PlayerRegistration): string | null {
  if (reg.autoplay && reg.clips.includes(reg.autoplay)) return reg.autoplay;
  return reg.clips.find((c) => c !== RESET_CLIP) ?? reg.clips[0] ?? null;
}

const NO_OP: AnimationTransport = {
  clips: [],
  selectedClip: null,
  autoplayClip: null,
  hasPlayer: false,
  playState: 'stopped',
  time: 0,
  duration: 0,
  registerPlayer: () => () => {},
  play: () => {},
  pause: () => {},
  stop: () => {},
  seek: () => {},
  selectClip: () => {},
  reportTime: () => {},
};

const AnimationTransportContext = createContext<AnimationTransport>(NO_OP);
AnimationTransportContext.displayName = 'AnimationTransportContext';

export function useAnimationTransport(): AnimationTransport {
  return useContext(AnimationTransportContext);
}

export function AnimationTransportProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<PlayerRegistration | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayState>('stopped');
  const [time, setTime] = useState(0);

  const clips = registration?.clips ?? [];
  const hasPlayer = registration !== null;
  const autoplayClip =
    registration?.autoplay && clips.includes(registration.autoplay) ? registration.autoplay : null;
  const duration =
    (selectedClip ? registration?.durations[selectedClip] : undefined) ?? 0;

  const registerPlayer = useCallback((reg: PlayerRegistration) => {
    setRegistration(reg);
    setSelectedClip(defaultClip(reg));
    setPlayState('stopped');
    setTime(0);
    return () => {
      setRegistration(null);
      setSelectedClip(null);
      setPlayState('stopped');
      setTime(0);
    };
  }, []);

  const play = useCallback(() => {
    if (selectedClip) setPlayState('playing');
  }, [selectedClip]);

  const pause = useCallback(() => setPlayState('paused'), []);

  const stop = useCallback(() => {
    setPlayState('stopped');
    setTime(0);
  }, []);

  const clampTime = useCallback(
    (t: number) => {
      const max = (selectedClip ? registration?.durations[selectedClip] : undefined) ?? 0;
      return Math.max(0, Math.min(t, max));
    },
    [registration, selectedClip]
  );

  const seek = useCallback((t: number) => setTime(clampTime(t)), [clampTime]);

  const selectClip = useCallback((name: string) => {
    setSelectedClip(name);
    setTime(0);
  }, []);

  const reportTime = useCallback((t: number) => setTime(clampTime(t)), [clampTime]);

  const value = useMemo<AnimationTransport>(
    () => ({
      clips,
      selectedClip,
      autoplayClip,
      hasPlayer,
      playState,
      time,
      duration,
      registerPlayer,
      play,
      pause,
      stop,
      seek,
      selectClip,
      reportTime,
    }),
    [
      clips,
      selectedClip,
      autoplayClip,
      hasPlayer,
      playState,
      time,
      duration,
      registerPlayer,
      play,
      pause,
      stop,
      seek,
      selectClip,
      reportTime,
    ]
  );

  return (
    <AnimationTransportContext.Provider value={value}>
      {children}
    </AnimationTransportContext.Provider>
  );
}
