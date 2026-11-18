import { describe, expect, it } from 'vitest';
import { gameStartFacts } from './gameStartFacts';

describe('gameStartFacts', () => {
  it('finds no current camera for 3D content in the root window with no Camera3D current', () => {
    expect(gameStartFacts(0, 2, null).lacksCamera3D).toBe(true);
  });

  it('finds the current camera of the root window', () => {
    expect(gameStartFacts(0, 2, 'Main/Camera').lacksCamera3D).toBe(false);
  });

  it('needs no camera for a root window with no 3D content', () => {
    expect(gameStartFacts(0, 0, null).lacksCamera3D).toBe(false);
  });
});
