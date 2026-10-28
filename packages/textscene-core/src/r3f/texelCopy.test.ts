/** The one texel copy pass: a placement per draw, and the sRGB transfer a view copy needs. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { copyTexels, wholeTexels, type TexelTransfer } from './texelCopy';

/** A renderer that keeps the uniforms and fragment of each pass it draws, read during the draw. */
function passRecorder() {
  const drawn: {
    pass: THREE.ShaderMaterial;
    fragment: string;
    source: unknown;
    placement: unknown;
    bounds: unknown;
  }[] = [];
  const gl = {
    setRenderTarget: () => {},
    render: (quad: THREE.Mesh) => {
      const pass = quad.material as THREE.ShaderMaterial;
      drawn.push({
        pass,
        fragment: pass.fragmentShader,
        source: pass.uniforms.source!.value,
        placement: pass.uniforms.placement!.value,
        bounds: pass.uniforms.bounds!.value,
      });
    },
  };
  return { gl: gl as unknown as THREE.WebGLRenderer, drawn };
}

const copyWith = (transfer?: TexelTransfer) => {
  const { gl, drawn } = passRecorder();
  const source = new THREE.Texture();
  copyTexels(gl, source, null, wholeTexels(4, 2), transfer);
  return { drawn: drawn[0]!, source };
};

describe('copyTexels', () => {
  it('draws the source through its placement', () => {
    const { drawn, source } = copyWith();
    expect(drawn).toMatchObject({ source, placement: [0, 0, 1], bounds: [0, 0, 4, 2] });
  });

  it('copies each texel unchanged with no transfer', () => {
    expect(copyWith().drawn.fragment).not.toContain('sRGBTransfer');
  });

  it('decodes each texel for a copy whose sRGB storage encodes it back', () => {
    expect(copyWith('decode').drawn.fragment).toContain('sRGBTransferEOTF');
  });

  it('encodes each texel for a copy that holds the bytes an sRGB storage decoded', () => {
    expect(copyWith('encode').drawn.fragment).toContain('sRGBTransferOETF');
  });

  it('holds no texture once the draw ends', () => {
    expect(copyWith().drawn.pass.uniforms.source!.value).toBeNull();
  });
});
