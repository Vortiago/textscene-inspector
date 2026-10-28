/**
 * The two views a sub-viewport pass publishes of its target, as Godot's `R8G8B8A8_UNORM` storage
 * with an `R8G8B8A8_SRGB` view. The target serves the view its storage is, and a copy serves the
 * other (a canvas target is the plain view, a 3D target the decoding view).
 */
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TargetView } from '../../../r3f/contexts/ViewportTextureContext.js';
import { holdsSrgbBytes } from '../../../r3f/srgbByteTextures.js';
import { drawOffscreen } from '../../../r3f/offscreen.js';
import { copyTexels, wholeTexels, type TexelPlacement, type TexelTransfer } from '../../../r3f/texelCopy.js';
import { publishLiveTargets, refillLiveCopies } from '../../../r3f/liveTargets';
import { holdUntilReleased, isHeld, useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { copySampling } from '../../../resources/textures/copySampling.js';
import { storeSrgbBytes } from './offscreenViewport.js';

/** A view as its pass holds it: `fill` runs after each render of the pass, inside one offscreen draw. */
interface PassView extends TargetView {
  fill(): void;
  dispose(): void;
}

/** Both views of a target, filled and disposed together. `fill` fills each reader's copy after. */
interface PassTargetViews {
  plain: PassView;
  decoding: PassView;
  fill(): void;
  dispose(): void;
}

/** The views of `target`, live while it is mounted and disposed with it. `isTransparent` is `transparent_bg`. */
export function useTargetViews(target: THREE.WebGLRenderTarget, isTransparent: boolean): PassTargetViews {
  const gl = useThree((state) => state.gl);
  const views = useMemo(() => {
    const holdsBytes = holdsSrgbBytes(target.texture);
    const plain = holdsBytes ? ownStorageView(target.texture) : plainCopy(gl, target);
    const decoding = holdsBytes ? decodingCopy(gl, target) : ownStorageView(target.texture);
    return {
      plain,
      decoding,
      // One save and restore of the renderer for the views and every copy a reader holds.
      fill: () =>
        drawOffscreen(gl, () => {
          plain.fill();
          decoding.fill();
          refillLiveCopies(plain.texture, gl);
          refillLiveCopies(decoding.texture, gl);
        }),
      dispose: () => {
        plain.dispose();
        decoding.dispose();
      },
    };
  }, [gl, target]);
  useDisposeOnRelease(views);
  useEffect(
    () => publishLiveTargets([views.plain.texture, views.decoding.texture], gl, isTransparent),
    [views, gl, isTransparent]
  );
  return views;
}

/** The view of a target whose storage is that view already, so it needs no copy. */
function ownStorageView(texture: THREE.Texture): PassView {
  return { texture, retain: () => () => {}, fill: () => {}, dispose: () => {} };
}

/**
 * A view that is a copy of the target, which `fill` refreshes while a consumer retains it. WebGL2
 * has no texture views, so the copy stands in for the view the target's storage is not.
 */
class ViewCopy implements PassView {
  readonly texture: THREE.Texture;
  private readonly copy: THREE.WebGLRenderTarget;
  private readonly whole: TexelPlacement;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly source: THREE.WebGLRenderTarget,
    private readonly transfer: TexelTransfer
  ) {
    this.copy = new THREE.WebGLRenderTarget(source.width, source.height, { depthBuffer: false });
    this.whole = wholeTexels(source.width, source.height);
    copySampling(this.copy.texture, source.texture);
    this.texture = this.copy.texture;
  }

  /** The copy fills while a consumer holds it, and frees its storage once none does. */
  retain(): () => void {
    return holdUntilReleased(this);
  }

  /** Refreshes the copy while a consumer holds it. The caller draws offscreen. */
  fill(): void {
    if (isHeld(this)) copyTexels(this.gl, this.source.texture, this.copy, this.whole, this.transfer);
  }

  dispose(): void {
    this.copy.dispose();
  }
}

/**
 * The copy a canvas-content target serves as its decoding view: the decode of each byte, which the
 * SRGB8_ALPHA8 storage encodes back to the same byte.
 */
function decodingCopy(gl: THREE.WebGLRenderer, plain: THREE.WebGLRenderTarget): PassView {
  const view = new ViewCopy(gl, plain, 'decode');
  view.texture.name = `${plain.texture.name}::decoding`;
  view.texture.colorSpace = THREE.SRGBColorSpace;
  view.texture.internalFormat = 'SRGB8_ALPHA8';
  return view;
}

/**
 * The copy a 3D-content target serves as its plain view, which a canvas consumer filters raw: the
 * encode of each decoded texel, which is the stored byte again.
 */
function plainCopy(gl: THREE.WebGLRenderer, decoding: THREE.WebGLRenderTarget): PassView {
  const view = new ViewCopy(gl, decoding, 'encode');
  view.texture.name = `${decoding.texture.name}::plain`;
  storeSrgbBytes(view.texture);
  return view;
}
