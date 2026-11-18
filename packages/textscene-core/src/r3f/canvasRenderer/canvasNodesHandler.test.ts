import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type * as THREE from 'three';
import { float } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { useNodesHandler } from './canvasNodesHandler';

/** The hook three's types leave out of the handler. */
type OutputHook = { getOutputCallback: (outputNode: Node) => Node };

function fakeRenderer() {
  const setNodesHandler = vi.fn();
  return { gl: { setNodesHandler, debug: {} } as unknown as THREE.WebGLRenderer, setNodesHandler };
}

describe('useNodesHandler', () => {
  it('gives the renderer a nodes handler that writes linear, for the compositor to encode once', async () => {
    const { gl, setNodesHandler } = fakeRenderer();
    const { result } = renderHook(() => useNodesHandler(gl, true));
    await waitFor(() => expect(result.current).toBe('ready'));
    const handler = setNodesHandler.mock.calls[0]![0] as OutputHook;
    const output = float(0.25);
    expect(handler.getOutputCallback(output)).toBe(output);
  });

  it('is ready at once, and installs nothing, for a caller that draws no node material (edge case)', () => {
    const { gl, setNodesHandler } = fakeRenderer();
    expect(renderHook(() => useNodesHandler(gl, false)).result.current).toBe('ready');
    expect(setNodesHandler).not.toHaveBeenCalled();
  });
});
