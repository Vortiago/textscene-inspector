import { afterEach, describe, expect, it, vi } from 'vitest';
import { TscnParser } from '../parser/TscnParser.js';
import { parseTscnContent } from './parseScene.js';

const MINIMAL_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="."]
`;

const MALFORMED_TSCN = '[this is { not valid tscn at all';

describe('parseTscnContent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a SceneGraph rooted at the given path for valid content', () => {
    const { sceneGraph, error } = parseTscnContent(MINIMAL_TSCN, 'res://my-scene.tscn');
    expect(error).toBeNull();
    expect(sceneGraph).not.toBeNull();
    expect(sceneGraph!.rootScene).toBe('res://my-scene.tscn');
    expect(sceneGraph!.flattenedNodes.map((n) => n.name)).toEqual(['Root', 'Child']);
  });

  it('keeps the [editable] paths of the root scene on its ParsedScene', () => {
    const content = `${MINIMAL_TSCN}\n[editable path="Child"]\n`;
    const { sceneGraph } = parseTscnContent(content, 'res://my-scene.tscn');
    expect(sceneGraph!.scenes.get('res://my-scene.tscn')!.editableInstances).toEqual(['Child']);
  });

  it('returns a passive null result (no error) for empty content', () => {
    expect(parseTscnContent('', 'res://x.tscn')).toEqual({ sceneGraph: null, error: null });
  });

  it('synthesises a GLBSceneRoot scene for a .glb root path, ignoring the (binary) content', () => {
    const { sceneGraph, error } = parseTscnContent('binary-garbage-not-tscn', 'res://models/player.glb');
    expect(error).toBeNull();
    expect(sceneGraph).not.toBeNull();
    expect(sceneGraph!.flattenedNodes).toHaveLength(1);
    const root = sceneGraph!.flattenedNodes[0]!;
    expect(root.data.type).toBe('GLBSceneRoot');
    expect(root.name).toBe('player');
    expect((root.data.properties as Record<string, unknown>).glbPath).toBe('res://models/player.glb');
  });

  it('synthesises a GLBSceneRoot for a .gltf root path even with empty content', () => {
    const { sceneGraph } = parseTscnContent('', 'res://lamp/scene.gltf');
    expect(sceneGraph!.flattenedNodes[0]!.data.type).toBe('GLBSceneRoot');
  });

  it('reports an error when non-empty content yields zero nodes (WI-R3F-7 / WEB-10)', () => {
    const { sceneGraph, error } = parseTscnContent(MALFORMED_TSCN, 'res://x.tscn');
    expect(sceneGraph).toBeNull();
    expect(error).toMatch(/Parser could not extract any nodes/i);
  });

  it('captures a thrown parser Error as the error message', () => {
    vi.spyOn(TscnParser.prototype, 'parse').mockImplementation(() => {
      throw new Error('boom from parser');
    });
    const { sceneGraph, error } = parseTscnContent(MINIMAL_TSCN, 'res://x.tscn');
    expect(sceneGraph).toBeNull();
    expect(error).toBe('boom from parser');
  });

  it('stringifies non-Error throwables', () => {
    vi.spyOn(TscnParser.prototype, 'parse').mockImplementation(() => {
      throw 'string failure';
    });
    const { error } = parseTscnContent(MINIMAL_TSCN, 'res://x.tscn');
    expect(error).toBe('string failure');
  });
});
