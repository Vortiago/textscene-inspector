import type * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PlaybackShaderTime, ShaderClock, type Playback } from '../../shaders/time/shaderClock.js';
import { perObject } from '../../utils/perObject.js';
import { useAnimationTransport } from '../contexts/AnimationTransportContext.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { projectTimeRolloverSeconds } from '../../parser/projectSettingsParser.js';

/** One `TIME` for every shader a renderer draws, as Godot keeps one (`renderer_compositor_rd.cpp:111`). */
class CanvasShaderTime {
  /** Written only by `advance`. */
  private playbackTime = new PlaybackShaderTime(new ShaderClock());
  private rolloverSeconds: number | undefined;
  /** The frame that last advanced the clock, so each frame advances it once whoever asks. */
  private advancedFrame: number | undefined;
  /** `TIME` of the frame now drawing. */
  time = 0;

  /** Moves `TIME` for `frame` by `step` seconds under `playback`, once per frame. */
  advance(frame: number, playback: Playback, step: number, rolloverSeconds: number): void {
    if (frame === this.advancedFrame) return;
    this.advancedFrame = frame;
    if (rolloverSeconds !== this.rolloverSeconds) {
      this.rolloverSeconds = rolloverSeconds;
      const clock = new ShaderClock(rolloverSeconds);
      clock.set(this.time);
      this.playbackTime = new PlaybackShaderTime(clock);
    }
    this.time = this.playbackTime.frame(playback, step);
  }
}

/** The shader time of each renderer, which lives as long as the renderer. */
export const canvasShaderTime = perObject((_gl: THREE.WebGLRenderer) => new CanvasShaderTime());

/** Advances the renderer's `TIME` before each frame. Every shader that reads `TIME` mounts it. */
export function useShaderTimeFrame(): void {
  const transport = useAnimationTransport();
  const { settings } = useProjectSettings();
  const rolloverSeconds = projectTimeRolloverSeconds(settings);
  useFrame(({ gl, clock }, step) => {
    const playback = {
      hasPlayer: transport.hasPlayer,
      playState: transport.playState,
      playhead: transport.time,
      seeks: transport.seeks,
    };
    canvasShaderTime(gl).advance(clock.elapsedTime, playback, step, rolloverSeconds);
  });
}
