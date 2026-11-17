/** Godot's default of `rendering/limits/time/time_rollover_secs` (`rendering_server.cpp:3700`). */
export const DEFAULT_TIME_ROLLOVER_SECONDS = 3600;

/** `TIME` as `RendererCompositorRD::begin_frame` moves it (`renderer_compositor_rd.cpp:107`). */
export class ShaderClock {
  /** A double, as Godot's `time` is. Written only by `advance` and `set`. */
  private seconds = 0;

  constructor(private readonly rolloverSeconds = DEFAULT_TIME_ROLLOVER_SECONDS) {}

  get time(): number {
    return this.seconds;
  }

  /** A frame of `step` seconds, before the frame draws: Godot's `Math::fmod`, which `%` is for doubles. */
  advance(step: number): number {
    return this.set(this.seconds + step);
  }

  set(seconds: number): number {
    this.seconds = seconds % this.rolloverSeconds;
    return this.seconds;
  }
}

/** The previewer's playback controls, as `AnimationTransportContext` holds them. */
export interface Playback {
  /** False in a scene with no AnimationPlayer, which has no controls. */
  readonly hasPlayer: boolean;
  readonly playState: 'stopped' | 'playing' | 'paused';
  /** The playhead in seconds. */
  readonly playhead: number;
}

/** `TIME` under the playback controls, where Godot's keeps running (ADR-0083). */
export class PlaybackShaderTime {
  /** The playhead of the last frame, so a change while not playing reads as a scrub. */
  private lastPlayhead: number | undefined;

  constructor(private readonly clock: ShaderClock) {}

  /** `TIME` for a frame of `step` seconds. */
  frame(playback: Playback, step: number): number {
    const isScrub = this.lastPlayhead !== undefined && playback.playhead !== this.lastPlayhead;
    this.lastPlayhead = playback.playhead;
    if (!playback.hasPlayer || playback.playState === 'playing') return this.clock.advance(step);
    if (playback.playState === 'stopped') return this.clock.set(0);
    return isScrub ? this.clock.set(playback.playhead) : this.clock.time;
  }
}
