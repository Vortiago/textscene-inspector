import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useParsedScene } from './useParsedScene.js';

const MINIMAL_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="."]
`;

describe('useParsedScene', () => {
  it('returns a stable result across rerenders with unchanged inputs', () => {
    const { result, rerender } = renderHook(({ content, path }) => useParsedScene(content, path), {
      initialProps: { content: MINIMAL_TSCN, path: 'res://a.tscn' },
    });
    const first = result.current;
    expect(first.sceneGraph).not.toBeNull();

    rerender({ content: MINIMAL_TSCN, path: 'res://a.tscn' });
    expect(result.current).toBe(first);
  });

  it('re-parses when the content changes', () => {
    const { result, rerender } = renderHook(({ content, path }) => useParsedScene(content, path), {
      initialProps: { content: MINIMAL_TSCN, path: 'res://a.tscn' },
    });
    const first = result.current;

    rerender({ content: MINIMAL_TSCN.replace('Root', 'Other'), path: 'res://a.tscn' });
    expect(result.current).not.toBe(first);
    expect(result.current.sceneGraph!.flattenedNodes[0]!.name).toBe('Other');
  });
});
