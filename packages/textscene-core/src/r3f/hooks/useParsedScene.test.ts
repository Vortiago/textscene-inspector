/**
 * Unit tests for the shell's parse pipeline — exercised directly, without
 * mounting the shell. Covers the happy path, both error paths (zero-node
 * salvage + parser throw), the empty-content passive state, and the hook's
 * memoization contract.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { TscnParser } from '../../parser/TscnParser.js';
import { parseTscnContent, useParsedScene } from './useParsedScene.js';

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

describe('useParsedScene', () => {
  it('returns a stable result across rerenders with unchanged inputs', () => {
    const { result, rerender } = renderHook(
      ({ content, path }) => useParsedScene(content, path),
      { initialProps: { content: MINIMAL_TSCN, path: 'res://a.tscn' } }
    );
    const first = result.current;
    expect(first.sceneGraph).not.toBeNull();

    rerender({ content: MINIMAL_TSCN, path: 'res://a.tscn' });
    expect(result.current).toBe(first);
  });

  it('re-parses when the content changes', () => {
    const { result, rerender } = renderHook(
      ({ content, path }) => useParsedScene(content, path),
      { initialProps: { content: MINIMAL_TSCN, path: 'res://a.tscn' } }
    );
    const first = result.current;

    rerender({ content: MINIMAL_TSCN.replace('Root', 'Other'), path: 'res://a.tscn' });
    expect(result.current).not.toBe(first);
    expect(result.current.sceneGraph!.flattenedNodes[0]!.name).toBe('Other');
  });
});
