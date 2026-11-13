/** The one preparation every canvas's renderer gets before its first frame. */

import { describe, expect, it, vi } from 'vitest';
import type { RootState } from '@react-three/fiber';
import { float } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { prepareCanvasRenderer } from './prepareCanvasRenderer';

/** The hook three's types leave out of the handler. */
type OutputHook = { getOutputCallback: (outputNode: Node) => Node };

describe('prepareCanvasRenderer', () => {
  it('gives the renderer a nodes handler that writes linear, for the compositor to encode once', () => {
    const setNodesHandler = vi.fn();
    prepareCanvasRenderer({ gl: { setNodesHandler } } as unknown as RootState);
    const handler = setNodesHandler.mock.calls[0]![0] as OutputHook;
    const output = float(0.25);

    expect(handler.getOutputCallback(output)).toBe(output);
  });
});
