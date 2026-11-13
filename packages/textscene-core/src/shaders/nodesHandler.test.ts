/** The install of three's nodes handler on a renderer, at most once for each renderer. */

import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { float, type Node } from 'three/tsl';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import { installNodesHandler } from './nodesHandler';

/** A renderer that records each handler it is given: the install needs no GL context. */
function recordingRenderer() {
  const setNodesHandler = vi.fn();
  return { renderer: { setNodesHandler } as unknown as THREE.WebGLRenderer, setNodesHandler };
}

/** The hook three's types leave out of the handler. */
type OutputHook = { getOutputCallback: (outputNode: Node) => Node };

describe('installNodesHandler', () => {
  it('gives a renderer one handler', () => {
    const { renderer, setNodesHandler } = recordingRenderer();

    installNodesHandler(renderer, 'linear');

    expect(setNodesHandler).toHaveBeenCalledTimes(1);
  });

  it('changes nothing on a second call for the same renderer', () => {
    const { renderer, setNodesHandler } = recordingRenderer();

    installNodesHandler(renderer, 'linear');
    installNodesHandler(renderer);

    expect(setNodesHandler).toHaveBeenCalledTimes(1);
  });

  it('gives each renderer its own handler', () => {
    const first = recordingRenderer();
    const second = recordingRenderer();

    installNodesHandler(first.renderer, 'linear');
    installNodesHandler(second.renderer, 'linear');

    expect(second.setNodesHandler).toHaveBeenCalledTimes(1);
    expect(second.setNodesHandler.mock.calls[0]![0]).not.toBe(first.setNodesHandler.mock.calls[0]![0]);
  });

  it('writes a linear output unchanged', () => {
    const { renderer, setNodesHandler } = recordingRenderer();
    installNodesHandler(renderer, 'linear');
    const handler = setNodesHandler.mock.calls[0]![0] as OutputHook;
    const output = float(0.5);

    expect(handler.getOutputCallback(output)).toBe(output);
  });

  it("keeps the handler's own tone mapping and colour space by default", () => {
    const { renderer, setNodesHandler } = recordingRenderer();
    installNodesHandler(renderer);
    const handler = setNodesHandler.mock.calls[0]![0] as OutputHook;
    const stock = new WebGLNodesHandler() as unknown as OutputHook;

    expect(handler.getOutputCallback.toString()).toBe(stock.getOutputCallback.toString());
  });
});
