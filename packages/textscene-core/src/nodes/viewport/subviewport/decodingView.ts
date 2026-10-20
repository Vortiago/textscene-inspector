/**
 * The decoding view a sub-viewport pass publishes beside its plain view. A canvas-content target
 * holds sRGB bytes in RGBA8, so its decoding view is an SRGB8_ALPHA8 copy, which the pass fills
 * after each render while a consumer retains it. A 3D-content target decodes in its own storage.
 */
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DecodingView } from '../../../r3f/contexts/ViewportTextureContext.js';
import { holdsSrgbBytes } from '../../../r3f/srgbByteTextures.js';
import { drawFullScreen, fullScreenPass } from '../../../r3f/fullScreenPass.js';
import { drawOffscreen } from '../../../r3f/offscreen.js';
import { perRenderer } from '../../../r3f/perRenderer.js';

/** A decoding view as its pass holds it: `fill` runs after each render of the pass. */
export interface PassDecodingView extends DecodingView {
  fill(): void;
  dispose(): void;
}

/** The decoding view of `target`, disposed with it. */
export function useDecodingView(target: THREE.WebGLRenderTarget): PassDecodingView {
  const gl = useThree((state) => state.gl);
  const view = useMemo(
    () => (holdsSrgbBytes(target.texture) ? new DecodingCopy(gl, target) : ownStorageView(target.texture)),
    [gl, target]
  );
  useEffect(() => () => view.dispose(), [view]);
  return view;
}

/** The view of a target whose storage decodes each texel already, so it needs no copy. */
function ownStorageView(texture: THREE.Texture): PassDecodingView {
  return { texture, retain: () => () => {}, fill: () => {}, dispose: () => {} };
}

/**
 * Reads the plain view's sRGB bytes and writes their decode, which the SRGB8_ALPHA8 storage encodes
 * back to the same byte. The pass does not blend, so the alpha copies unchanged.
 */
const DECODE_FRAGMENT = /* glsl */ `
uniform sampler2D plain;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D( plain, vUv );
  gl_FragColor = vec4( sRGBTransferEOTF( texel ).rgb, texel.a );
}`;

/** The decode pass a renderer fills every copy with. `fill` binds the plain view before each draw. */
const decodePassFor = perRenderer(() =>
  fullScreenPass('DecodingViewCopy', DECODE_FRAGMENT, { plain: { value: null } })
);

/** The copy a canvas-content target serves as its decoding view. */
class DecodingCopy implements PassDecodingView {
  readonly texture: THREE.Texture;
  private readonly copy: THREE.WebGLRenderTarget;
  /** Written only by `retain` and its release. The copy fills while it is above zero. */
  private retainers = 0;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly plain: THREE.WebGLRenderTarget
  ) {
    this.copy = new THREE.WebGLRenderTarget(plain.width, plain.height, { depthBuffer: false });
    this.copy.texture.name = `${plain.texture.name}::decoding`;
    this.copy.texture.colorSpace = THREE.SRGBColorSpace;
    this.copy.texture.internalFormat = 'SRGB8_ALPHA8';
    this.copy.texture.minFilter = plain.texture.minFilter;
    this.copy.texture.magFilter = plain.texture.magFilter;
    this.copy.texture.generateMipmaps = false;
    this.texture = this.copy.texture;
  }

  retain(): () => void {
    this.retainers++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.retainers--;
    };
  }

  fill(): void {
    if (this.retainers === 0) return;
    const pass = decodePassFor(this.gl);
    pass.uniforms.plain!.value = this.plain.texture;
    drawOffscreen(this.gl, () => drawFullScreen(this.gl, pass, this.copy));
  }

  dispose(): void {
    this.copy.dispose();
  }
}
