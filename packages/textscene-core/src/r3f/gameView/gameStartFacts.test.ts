import { describe, expect, it } from 'vitest';
import '../nodes/index';
import { gameStartFacts } from './gameStartFacts';
import type { LiveTreeEntry } from '../liveSceneTree';

function entry(path: string, type: string, rawProperties: Record<string, string> = {}): LiveTreeEntry {
  const name = path.split('/').at(-1) ?? path;
  return { path, node: { name, type, rawProperties, properties: {}, children: [] } } as LiveTreeEntry;
}

const SCRIPT = { script: 'ExtResource("1_player")' };

describe('gameStartFacts', () => {
  it('counts each node that holds a script', () => {
    const entries = [
      entry('Main', 'Node3D', SCRIPT),
      entry('Main/Player', 'Node3D', SCRIPT),
      entry('Main/Box', 'Node3D'),
    ];
    expect(gameStartFacts(entries, 'Main/Camera').scriptedNodes).toBe(2);
  });

  it('counts no node whose script is null', () => {
    expect(gameStartFacts([entry('Main', 'Node2D', { script: 'null' })], null).scriptedNodes).toBe(0);
  });

  it('counts a script inside a SubViewport, since Godot runs it too', () => {
    const entries = [
      entry('Main', 'Control'),
      entry('Main/View', 'SubViewport'),
      entry('Main/View/Hud', 'Control', SCRIPT),
    ];
    expect(gameStartFacts(entries, null).scriptedNodes).toBe(1);
  });

  it('finds no current camera for a 3D world with no Camera3D current', () => {
    expect(
      gameStartFacts([entry('Main', 'Node3D'), entry('Main/Box', 'MeshInstance3D')], null).lacksCamera3D
    ).toBe(true);
  });

  it('finds the current camera of a 3D world', () => {
    const entries = [entry('Main', 'Node3D'), entry('Main/Camera', 'Camera3D')];
    expect(gameStartFacts(entries, 'Main/Camera').lacksCamera3D).toBe(false);
  });

  it('needs no camera for a 2D scene', () => {
    expect(
      gameStartFacts([entry('Main', 'Node2D'), entry('Main/Sprite', 'Sprite2D')], null).lacksCamera3D
    ).toBe(false);
  });

  it('needs no camera of the root window for a 3D world inside a SubViewport', () => {
    const entries = [
      entry('Main', 'Control'),
      entry('Main/View', 'SubViewport'),
      entry('Main/View/Box', 'MeshInstance3D'),
    ];
    expect(gameStartFacts(entries, null).lacksCamera3D).toBe(false);
  });
});
