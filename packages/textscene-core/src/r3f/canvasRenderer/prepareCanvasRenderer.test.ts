/** The one preparation every canvas's renderer gets before its first frame. */

import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import * as shaderPatches from '../shaderPatch/installShaderPatches';
import * as textureCopies from '../../shaders/uniforms/textureCopies';
import { heldLiveTargetCopy } from '../liveTargets';
import { installGodotOpaqueOrder } from '../../shaders/pipeline/opaqueOrder';
import * as shadowAtlas from '../directionalShadow/shadowAtlas';
import { prepareCanvasRenderer } from './prepareCanvasRenderer';

// The probe draws a pixel, which the fake renderer cannot.
vi.mock('../directionalShadow/storedDepthRead', () => ({
  decideStoredDepthRead: () => 'float',
  storedDepthRead: () => 'float',
}));

const renderer = () =>
  ({
    setOpaqueSort: vi.fn(),
    renderBufferDirect: vi.fn(),
    getContext: vi.fn(),
  }) as unknown as THREE.WebGLRenderer;

/** The opaque sort `installGodotOpaqueOrder` sets. */
function godotOpaqueSort(): unknown {
  const setOpaqueSort = vi.fn();
  installGodotOpaqueOrder({ setOpaqueSort } as unknown as THREE.WebGLRenderer);
  return setOpaqueSort.mock.calls[0]![0];
}

describe('prepareCanvasRenderer', () => {
  it('formats the sun atlas colour for the decided read before any patch installs', () => {
    const format = vi.spyOn(shadowAtlas, 'formatDirectionalShadowColour');
    const install = vi.spyOn(shaderPatches, 'installShaderPatches');
    prepareCanvasRenderer({ gl: renderer() });
    expect(format).toHaveBeenCalledWith('float');
    expect(format.mock.invocationCallOrder[0]).toBeLessThan(install.mock.invocationCallOrder[0]!);
  });

  it('installs the shader patches', () => {
    const install = vi.spyOn(shaderPatches, 'installShaderPatches');
    prepareCanvasRenderer({ gl: renderer() });
    expect(install).toHaveBeenCalled();
  });

  it('gives a transpiled sampler a live copy of a render target', () => {
    const install = vi.spyOn(textureCopies, 'installTargetCopies');
    prepareCanvasRenderer({ gl: renderer() });
    expect(install).toHaveBeenCalledWith(heldLiveTargetCopy);
  });

  it('sorts the opaque draws in Godot’s order, which draws a stencil surface last', () => {
    const gl = renderer();
    prepareCanvasRenderer({ gl });
    expect(gl.setOpaqueSort).toHaveBeenCalledWith(godotOpaqueSort());
  });

  it('wraps the renderer’s draw for Godot’s polygon mode', () => {
    const gl = renderer();
    const draw = gl.renderBufferDirect;
    prepareCanvasRenderer({ gl });
    expect(gl.renderBufferDirect).not.toBe(draw);
  });
});
