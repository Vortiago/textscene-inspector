/**
 * ViewportTextureRegistry contract: the seam between a `<SubViewport>` publishing a `WebGLRenderTarget`
 * and its consumers, one shape for all content. Like **AnimationDriverRegistry** (CONTEXT.md), a
 * `nodePath → entry` lookup: a stable register function, so a publisher's effect does not re-fire,
 * and a reactive map, so a consumer re-renders when its target appears.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import * as THREE from 'three';

import {
  ViewportTextureProvider,
  useRegisterViewportTexture,
  useViewportTexture,
  type ViewportTextureEntry,
} from '../../r3f/contexts/ViewportTextureContext';
import { resolveViewportTexturePath } from '../../r3f/viewportTexturePath';

function entry(): ViewportTextureEntry {
  return {
    texture: new THREE.Texture(),
    size: { x: 256, y: 256 },
  };
}

/** Publishes `value` at `path` for as long as it is mounted. */
function Publisher({ path, value }: { path: string; value: ViewportTextureEntry }) {
  const registerViewportTexture = useRegisterViewportTexture();
  useEffect(
    () => registerViewportTexture(path, value),
    [registerViewportTexture, path, value]
  );
  return null;
}

function Consumer({ path, onResolve }: { path: string; onResolve: (e: ViewportTextureEntry | null) => void }) {
  const resolved = useViewportTexture(path);
  onResolve(resolved);
  return null;
}

describe('ViewportTextureRegistry contract', () => {
  it('resolves a published entry by node path', () => {
    const value = entry();
    const seen: (ViewportTextureEntry | null)[] = [];
    render(
      <ViewportTextureProvider>
        <Publisher path="Root/SubViewport" value={value} />
        <Consumer path="Root/SubViewport" onResolve={(e) => seen.push(e)} />
      </ViewportTextureProvider>
    );
    expect(seen.at(-1)).toBe(value);
  });

  it('publishes a texture every consumer samples directly, plus its size', () => {
    const value = entry();
    const seen: (ViewportTextureEntry | null)[] = [];
    render(
      <ViewportTextureProvider>
        <Publisher path="V" value={value} />
        <Consumer path="V" onResolve={(e) => seen.push(e)} />
      </ViewportTextureProvider>
    );
    const resolved = seen.at(-1);
    expect(resolved?.texture).toBeInstanceOf(THREE.Texture);
    expect(resolved?.size).toEqual({ x: 256, y: 256 });
  });

  it('returns null for an unpublished path rather than throwing', () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    render(
      <ViewportTextureProvider>
        <Consumer path="Nope" onResolve={(e) => seen.push(e)} />
      </ViewportTextureProvider>
    );
    expect(seen.at(-1)).toBeNull();
  });

  it('unregisters on unmount, so a removed sub-viewport stops resolving', () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    const { rerender } = render(
      <ViewportTextureProvider>
        <Publisher path="V" value={entry()} />
        <Consumer path="V" onResolve={(e) => seen.push(e)} />
      </ViewportTextureProvider>
    );
    expect(seen.at(-1)).not.toBeNull();
    rerender(
      <ViewportTextureProvider>
        <Consumer path="V" onResolve={(e) => seen.push(e)} />
      </ViewportTextureProvider>
    );
    expect(seen.at(-1)).toBeNull();
  });

  it('is null-safe without a provider, so linter and isolated tests still mount', () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    render(<Consumer path="V" onResolve={(e) => seen.push(e)} />);
    expect(seen.at(-1)).toBeNull();
  });
});

describe('resolveViewportTexturePath', () => {
  /**
   * Godot resolves `ViewportTexture.viewport_path` against the local scene root, not the node
   * holding the material, which is why such a material must set `resource_local_to_scene = true`.
   * Resolved from the quad, `NodePath("SubViewport")` finds nothing.
   */
  it('resolves a NodePath literal against the scene root', () => {
    expect(resolveViewportTexturePath('NodePath("SubViewport")')).toBe('SubViewport');
  });

  it('resolves a nested path against the scene root', () => {
    expect(resolveViewportTexturePath('NodePath("FogOfWar/CombinedViewport")')).toBe(
      'FogOfWar/CombinedViewport'
    );
  });

  it('returns null for a non-NodePath or absent value', () => {
    expect(resolveViewportTexturePath(undefined)).toBeNull();
    expect(resolveViewportTexturePath('SubViewport')).toBeNull();
    expect(resolveViewportTexturePath('NodePath("")')).toBeNull();
  });
});
