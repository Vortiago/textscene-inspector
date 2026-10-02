/**
 * Tests for `applyCorpusRoot`, the module's only export: setResourceRoot, and clearCaches on
 * a change.
 */
// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCorpusRoot } from './useCorpusRoot';
import type { ResourcePipeline } from '@textscene/core';
import type { WebResourceProvider } from './providers/WebResourceProvider';

function makePipeline() {
  const setResourceRoot = vi.fn<(root: string) => void>();
  const clearCaches = vi.fn<() => void>();
  const pipeline: ResourcePipeline<WebResourceProvider> = {
    provider: { setResourceRoot } as unknown as WebResourceProvider,
    loader: { clearCaches } as unknown as ResourcePipeline<WebResourceProvider>['loader'],
  };
  return { pipeline, setResourceRoot, clearCaches };
}

/** Mounts the hook and hands back its `applyCorpusRoot` plus the spies. */
function mountHook() {
  const parts = makePipeline();
  const { result } = renderHook(() => useCorpusRoot(parts.pipeline));
  return { ...parts, applyCorpusRoot: result.current };
}

describe('useCorpusRoot', () => {
  it('installs the base ("") routing on mount, before anything renders', () => {
    const { setResourceRoot } = mountHook();

    expect(setResourceRoot).toHaveBeenCalledWith('');
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
});
