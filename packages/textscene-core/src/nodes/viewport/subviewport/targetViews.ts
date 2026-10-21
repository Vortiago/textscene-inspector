/**
 * The two views a sub-viewport pass publishes of its target, as Godot's `R8G8B8A8_UNORM` storage
 * with an `R8G8B8A8_SRGB` view: the plain view a canvas item samples and the decoding view a
 * `source_color` slot samples. WebGL2 has no texture views, so the target serves the view its
 * storage already is, and a copy serves the other, which the pass fills after each render while a
 * consumer retains it. A canvas-content target holds sRGB bytes in RGBA8, so it is the plain view.
 * A 3D-content target is SRGB8_ALPHA8, so it is the decoding view.
 */
import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TargetView } from '../../../r3f/contexts/ViewportTextureContext.js';
import { holdsSrgbBytes, markSrgbBytes } from '../../../r3f/srgbByteTextures.js';
import { drawFullScreen, fullScreenPass } from '../../../r3f/fullScreenPass.js';
import { drawOffscreen } from '../../../r3f/offscreen.js';
import { perRenderer } from '../../../r3f/perRenderer.js';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { pinColorSpace } from '../../../resources/textures/applyTextureState.js';

/** A view as its pass holds it: `fill` runs after each render of the pass. */
export interface PassView extends TargetView {
  fill(): void;
  dispose(): void;
}

/** Both views of a target, filled and disposed together. */
export interface PassTargetViews {
  plain: PassView;
  decoding: PassView;
  fill(): void;
  dispose(): void;
}

/** The views of `target`, disposed with it. */
export function useTargetViews(target: THREE.WebGLRenderTarget): PassTargetViews {
  const gl = useThree((state) => state.gl);
  const views = useMemo(() => {
    const holdsBytes = holdsSrgbBytes(target.texture);
    const plain = holdsBytes ? ownStorageView(target.texture) : plainCopy(gl, target);
    const decoding = holdsBytes ? decodingCopy(gl, target) : ownStorageView(target.texture);
    return {
      plain,
      decoding,
      fill: () => {
        plain.fill();
        decoding.fill();
      },
      dispose: () => {
        plain.dispose();
        decoding.dispose();
      },
    };
  }, [gl, target]);
  useDisposeOnRelease(views);
  return views;
}

/** The view of a target whose storage is that view already, so it needs no copy. */
function ownStorageView(texture: THREE.Texture): PassView {
  return { texture, retain: () => () => {}, fill: () => {}, dispose: () => {} };
}

/**
 * Reads canvas bytes and writes their decode, which the SRGB8_ALPHA8 storage encodes back to the
 * same byte. The pass does not blend, so the alpha copies unchanged.
 */
const DECODE_FRAGMENT = /* glsl */ `
uniform sampler2D source;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D( source, vUv );
  gl_FragColor = vec4( sRGBTransferEOTF( texel ).rgb, texel.a );
}`;

/**
 * Reads a texel that the SRGB8_ALPHA8 storage decoded on sampling and writes its encode, which is
 * the stored byte again.
 */
const ENCODE_FRAGMENT = /* glsl */ `
uniform sampler2D source;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D( source, vUv );
  gl_FragColor = vec4( sRGBTransferOETF( texel ).rgb, texel.a );
}`;

/** The pass a renderer fills every copy of one kind with. `fill` binds the source before each draw. */
const copyPassFor = (name: string, fragment: string) =>
  perRenderer(() => fullScreenPass(name, fragment, { source: { value: null } }));
const decodePassFor = copyPassFor('DecodingViewCopy', DECODE_FRAGMENT);
const encodePassFor = copyPassFor('PlainViewCopy', ENCODE_FRAGMENT);

/**
 * A view that is a copy of the target, which `fill` refreshes while a consumer retains it. WebGL2
 * has no texture views, so the copy stands in for the view the target's storage is not.
 */
class ViewCopy implements PassView {
  readonly texture: THREE.Texture;
  private readonly copy: THREE.WebGLRenderTarget;
  /** Written only by `retain` and its release. The copy fills while it is above zero. */
  private retainers = 0;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly source: THREE.WebGLRenderTarget,
    private readonly passFor: typeof decodePassFor
  ) {
    this.copy = new THREE.WebGLRenderTarget(source.width, source.height, { depthBuffer: false });
    this.copy.texture.minFilter = source.texture.minFilter;
    this.copy.texture.magFilter = source.texture.magFilter;
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
    const pass = this.passFor(this.gl);
    pass.uniforms.source!.value = this.source.texture;
    drawOffscreen(this.gl, () => drawFullScreen(this.gl, pass, this.copy));
  }

  dispose(): void {
    this.copy.dispose();
  }
}

/** The copy a canvas-content target serves as its decoding view. */
function decodingCopy(gl: THREE.WebGLRenderer, plain: THREE.WebGLRenderTarget): PassView {
  const view = new ViewCopy(gl, plain, decodePassFor);
  view.texture.name = `${plain.texture.name}::decoding`;
  view.texture.colorSpace = THREE.SRGBColorSpace;
  view.texture.internalFormat = 'SRGB8_ALPHA8';
  return view;
}

/** The copy a 3D-content target serves as its plain view, which a canvas consumer filters raw. */
function plainCopy(gl: THREE.WebGLRenderer, decoding: THREE.WebGLRenderTarget): PassView {
  const view = new ViewCopy(gl, decoding, encodePassFor);
  view.texture.name = `${decoding.texture.name}::plain`;
  pinColorSpace(view.texture, THREE.SRGBColorSpace);
  view.texture.internalFormat = 'RGBA8';
  markSrgbBytes(view.texture);
  return view;
}
