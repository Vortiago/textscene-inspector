/**
 * VideoStreamPlayer self-registration: importing `index.r3f` wires the native (WebGL canvas)
 * painter, which draws nothing, and its minimum-size solver.
 */

import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { VideoStreamPlayer } from './Component';
import { videoStreamPlayerMinimumSize, videoStreamPlayerTextureSlots } from './nativeSolver';

describe('VideoStreamPlayer index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('VideoStreamPlayer')).toBe(VideoStreamPlayer);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('VideoStreamPlayer')).toBe(videoStreamPlayerMinimumSize);
  });

  it('registers the stream slot the minimum size reads', () => {
    expect(controlSolverRegistry.textureSlots('VideoStreamPlayer')).toBe(videoStreamPlayerTextureSlots);
  });
});
