import { describe, expect, it } from 'vitest';
import { isSoftwareRendererName, rendersInSoftware } from './softwareRenderer';

const UNMASKED_RENDERER_WEBGL = 0x9246;
const RENDERER = 0x1f01;

/** A context that names `renderer`, through the debug extension when `unmasked` is set. */
function namingContext(renderer: string, { unmasked }: { unmasked: boolean }): WebGL2RenderingContext {
  return {
    RENDERER,
    getExtension: (name: string) =>
      unmasked && name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL } : null,
    getParameter: (parameter: number) =>
      parameter === (unmasked ? UNMASKED_RENDERER_WEBGL : RENDERER) ? renderer : 'WebKit WebGL',
  } as unknown as WebGL2RenderingContext;
}

describe('isSoftwareRendererName', () => {
  it.each([
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Apple Software Renderer',
  ])('names %s a software renderer', (name) => {
    expect(isSoftwareRendererName(name)).toBe(true);
  });

  it.each([
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
    'Mesa Intel(R) Iris(R) Xe Graphics (TGL GT2)',
  ])('names %s a GPU', (name) => {
    expect(isSoftwareRendererName(name)).toBe(false);
  });

  it('names an empty string a GPU, since nothing says otherwise (edge case)', () => {
    expect(isSoftwareRendererName('')).toBe(false);
  });
});

describe('rendersInSoftware', () => {
  it('reads the unmasked renderer where the debug extension offers it', () => {
    expect(rendersInSoftware(namingContext('llvmpipe (LLVM 15.0.7)', { unmasked: true }))).toBe(true);
  });

  it('reads the plain renderer where the debug extension is missing', () => {
    expect(rendersInSoftware(namingContext('SwiftShader', { unmasked: false }))).toBe(true);
  });

  it('asks for no debug extension where the plain renderer is unmasked, as Firefox deprecates it', () => {
    const requested: string[] = [];
    const firefox = {
      RENDERER,
      getExtension: (name: string) => (requested.push(name), { UNMASKED_RENDERER_WEBGL }),
      getParameter: (parameter: number) => (parameter === RENDERER ? 'llvmpipe' : null),
    };
    expect(rendersInSoftware(firefox as unknown as WebGL2RenderingContext)).toBe(true);
    expect(requested).toEqual([]);
  });

  it('is false for a context that reports no renderer (error case)', () => {
    const lost = { RENDERER, getExtension: () => null, getParameter: () => null };
    expect(rendersInSoftware(lost as unknown as WebGL2RenderingContext)).toBe(false);
  });
});
