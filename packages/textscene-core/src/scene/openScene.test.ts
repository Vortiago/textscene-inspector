import { describe, expect, it, vi } from 'vitest';
import { openScene } from './openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';
import { TscnParser } from '../parser/TscnParser';

const provider = {} as ResourceProvider;

const sceneOf = (rootName: string) => `[gd_scene format=3]

[node name="${rootName}" type="Node2D"]
`;

describe('openScene', () => {
  it('parses the text into the scene graph of its root scene', () => {
    const scene = openScene({ source: sceneOf('Main'), provider, rootScenePath: 'res://main.tscn' });
    const { sceneGraph } = scene.parse();
    expect(sceneGraph?.scenes.get('res://main.tscn')?.nodes[0]?.name).toBe('Main');
  });

  it('parses the text once, however often a view reads it', () => {
    const parse = vi.spyOn(TscnParser.prototype, 'parse');
    const scene = openScene({ source: sceneOf('Main'), provider });
    scene.parse();
    scene.parse();
    expect(parse).toHaveBeenCalledTimes(1);
    parse.mockRestore();
  });

  it('replaces the parse when setSource gives a new text', () => {
    const scene = openScene({ source: sceneOf('Main'), provider });
    scene.setSource(sceneOf('Level'));
    expect(scene.parse().sceneGraph?.scenes.get(scene.rootScenePath)?.nodes[0]?.name).toBe('Level');
  });

  it('tells a subscriber when setSource replaces the parse', () => {
    const scene = openScene({ source: sceneOf('Main'), provider });
    const listener = vi.fn();
    scene.subscribe(listener);
    scene.setSource(sceneOf('Level'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the parse when setSource gives the same text', () => {
    const scene = openScene({ source: sceneOf('Main'), provider });
    const first = scene.parse();
    scene.setSource(sceneOf('Main'));
    expect(scene.parse()).toBe(first);
  });

  it('answers an error for a text that holds no node', () => {
    const scene = openScene({ source: 'not a scene', provider });
    expect(scene.parse().error).toMatch(/could not extract any nodes/);
  });

  it('tells no subscriber after dispose', () => {
    const scene = openScene({ source: sceneOf('Main'), provider });
    const listener = vi.fn();
    scene.subscribe(listener);
    scene.dispose();
    scene.setSource(sceneOf('Level'));
    expect(listener).not.toHaveBeenCalled();
  });
});
