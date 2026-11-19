/** The one preparation every canvas's renderer gets before its first frame. */

import { describe, expect, it, vi } from 'vitest';
import * as shaderPatches from '../shaderPatch/installShaderPatches';
import * as textureCopies from '../../shaders/uniforms/textureCopies';
import { heldLiveTargetCopy } from '../liveTargets';
import { prepareCanvasRenderer } from './prepareCanvasRenderer';

describe('prepareCanvasRenderer', () => {
  it('installs the shader patches', () => {
    const install = vi.spyOn(shaderPatches, 'installShaderPatches');
    prepareCanvasRenderer();
    expect(install).toHaveBeenCalled();
  });

  it('gives a transpiled sampler a live copy of a render target', () => {
    const install = vi.spyOn(textureCopies, 'installTargetCopies');
    prepareCanvasRenderer();
    expect(install).toHaveBeenCalledWith(heldLiveTargetCopy);
  });
});
