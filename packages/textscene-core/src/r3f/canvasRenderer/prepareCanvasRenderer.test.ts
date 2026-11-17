/** The one preparation every canvas's renderer gets before its first frame. */

import { describe, expect, it, vi } from 'vitest';
import * as shaderPatches from '../shaderPatch/installShaderPatches';
import { prepareCanvasRenderer } from './prepareCanvasRenderer';

describe('prepareCanvasRenderer', () => {
  it('installs the shader patches', () => {
    const install = vi.spyOn(shaderPatches, 'installShaderPatches');
    prepareCanvasRenderer();
    expect(install).toHaveBeenCalled();
  });
});
