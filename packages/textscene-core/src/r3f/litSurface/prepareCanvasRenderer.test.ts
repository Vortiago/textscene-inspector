/** The one preparation every canvas's renderer gets before its first frame. */

import { describe, expect, it, vi } from 'vitest';
import type { RootState } from '@react-three/fiber';
import { float } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { SplitSunLight } from '../directionalShadow/splitSun';
import { GodotSunLightNode } from '../../shaders/sunLightNode';
import { prepareCanvasRenderer } from './prepareCanvasRenderer';
import { litShading } from './litShading';

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

  it('shades a split sun through the sun node, which three resolves on the light’s prototype', () => {
    prepareCanvasRenderer({ gl: { setNodesHandler: vi.fn() } } as unknown as RootState);
    // `LightsNode` reads `light._lightNode` (r187 `LightsNode.js:263`), which `Light.registerNode` sets.
    const { _lightNode } = new SplitSunLight() as unknown as { _lightNode?: unknown };

    expect(_lightNode).toBe(GodotSunLightNode);
  });

  it('gives every canvas one shading, as the classic inputs are the page’s', () => {
    prepareCanvasRenderer({ gl: { setNodesHandler: vi.fn() } } as unknown as RootState);
    const first = litShading();
    prepareCanvasRenderer({ gl: { setNodesHandler: vi.fn() } } as unknown as RootState);

    expect(litShading()).toBe(first);
  });
});
