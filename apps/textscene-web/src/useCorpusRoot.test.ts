/**
 * useCorpusRoot — owns the root-switch sequence for the web previewer:
 * setResourceRoot, THREE URL modifier, and clearCaches on change. The switch is
 * applied explicitly at a scene swap (never derived from the selection), so
 * these cover the returned `applyCorpusRoot` — the module's only export.
 */
// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCorpusRoot } from './useCorpusRoot';
import type { ResourcePipeline } from '@textscene/core';
import type { WebResourceProvider } from './providers/WebResourceProvider';

function makePipeline() {
  const setResourceRoot = vi.fn<(root: string) => void>();
  const setURLModifier = vi.fn<(modify: (url: string) => string) => void>();
  const clearCaches = vi.fn<() => void>();
  const pipeline: ResourcePipeline<WebResourceProvider> = {
    provider: { setResourceRoot } as unknown as WebResourceProvider,
    loader: {
      clearCaches,
      eventBus: {
        getThreeManager: () => ({ setURLModifier }),
      },
    } as unknown as ResourcePipeline<WebResourceProvider>['loader'],
  };
  return { pipeline, setResourceRoot, setURLModifier, clearCaches };
}

/** Mounts the hook and hands back its `applyCorpusRoot` plus the spies. */
function mountHook() {
  const parts = makePipeline();
  const { result } = renderHook(() => useCorpusRoot(parts.pipeline));
  return { ...parts, applyCorpusRoot: result.current };
}

describe('useCorpusRoot', () => {
  it('installs the base ("") routing on mount, before anything renders', () => {
    const { setResourceRoot, setURLModifier } = mountHook();

    expect(setResourceRoot).toHaveBeenCalledWith('');
    expect(setURLModifier).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does NOT clear caches on the initial mount', () => {
    const { clearCaches } = mountHook();

    expect(clearCaches).not.toHaveBeenCalled();
  });

  it('routes the provider at the root it is applied with', () => {
    const { applyCorpusRoot, setResourceRoot } = mountHook();

    applyCorpusRoot('demos/2d/platformer');

    expect(setResourceRoot).toHaveBeenLastCalledWith('demos/2d/platformer');
  });

  it('does NOT clear on the first scene swap — nothing has been loaded to go stale', () => {
    const { applyCorpusRoot, clearCaches } = mountHook();

    applyCorpusRoot('demos/2d/platformer');

    expect(clearCaches).not.toHaveBeenCalled();
  });

  it('clears caches exactly once when the root actually changes', () => {
    const { applyCorpusRoot, clearCaches } = mountHook();

    applyCorpusRoot('demos/2d/platformer');
    applyCorpusRoot('demos/3d/fps');

    expect(clearCaches).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — re-applying the same root neither re-routes nor clears', () => {
    const { applyCorpusRoot, setResourceRoot, clearCaches } = mountHook();

    applyCorpusRoot('demos/2d/platformer');
    const routedOnce = setResourceRoot.mock.calls.length;
    applyCorpusRoot('demos/2d/platformer');

    expect(setResourceRoot.mock.calls.length).toBe(routedOnce);
    expect(clearCaches).not.toHaveBeenCalled();
  });

  it('re-renders never re-apply on their own — only an explicit swap moves the root', () => {
    const { pipeline, setResourceRoot, clearCaches } = makePipeline();

    const { result, rerender } = renderHook(() => useCorpusRoot(pipeline));
    result.current('demos/2d/platformer');
    setResourceRoot.mockClear();
    clearCaches.mockClear();

    rerender();

    expect(setResourceRoot).not.toHaveBeenCalled();
    expect(clearCaches).not.toHaveBeenCalled();
  });

  it('maps res:// URLs to /fixtures/ via the URL modifier using the applied root', () => {
    const { applyCorpusRoot, setURLModifier } = mountHook();

    applyCorpusRoot('demos/2d/platformer');

    const modifier = setURLModifier.mock.lastCall![0];
    expect(modifier('res://textures/player.png')).toBe(
      '/fixtures/demos/2d/platformer/textures/player.png'
    );
  });

  it('remaps res:// URLs with the new root after a root change', () => {
    const { applyCorpusRoot, setURLModifier } = mountHook();

    applyCorpusRoot('demos/2d/platformer');
    applyCorpusRoot('demos/3d/fps');

    const modifier = setURLModifier.mock.lastCall![0];
    expect(modifier('res://textures/player.png')).toBe(
      '/fixtures/demos/3d/fps/textures/player.png'
    );
  });

  it('passes non-res:// URLs through the URL modifier unchanged', () => {
    const { setURLModifier } = mountHook();

    const modifier = setURLModifier.mock.lastCall![0];
    expect(modifier('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
  });
});
