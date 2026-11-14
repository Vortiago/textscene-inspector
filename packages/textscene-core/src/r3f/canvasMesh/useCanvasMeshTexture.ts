/**
 * The texture of a canvas mesh drawer: loaded through `useCanvasItemTexture`, viewed in the
 * canvas's texture colour space and windowed for a sprite frame. A drawer reads the load state and
 * the size, which its geometry needs. The view and the CanvasTexture stay for `CanvasMeshBody`.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import type { ScopedReference } from '../../resources/reading';
import type { ImageSize } from '../../resources/formats/image/imagePixels';
import { useCanvasItemTexture, type CanvasItemTexture } from '../canvasItemTexture';
import { useWindowedCanvas2DTexture } from '../canvas2DTextureDecode';
import type { UvWindow } from '../uvWindow';

/** What a texture slot holds now. */
export type CanvasMeshTextureState =
  /** The slot names no texture. */
  | 'none'
  /** The slot names a texture that is not here yet. */
  | 'arriving'
  /** The slot names a texture that never draws. */
  | 'missing'
  /** The texture draws. */
  | 'ready';

/** The texture as it loaded, for a window that depends on it. */
export interface LoadedCanvasMeshTexture {
  source: THREE.Texture | null;
  size: ImageSize | undefined;
  hasNoImage: boolean;
}

export interface CanvasMeshTextureSlot {
  /** The texture the item draws. Null is an item with no texture. */
  reference: ScopedReference | null;
  /** The window of the texture to show, for a sprite frame. Absent shows the whole texture. Keep it stable. */
  windowOf?: (loaded: LoadedCanvasMeshTexture) => UvWindow;
}

/** The key of what only `CanvasMeshBody` reads. */
export const DRAWN_TEXTURE: unique symbol = Symbol('drawnTexture');

export interface CanvasMeshTexture {
  readonly state: CanvasMeshTextureState;
  /** The reported size, for a drawer that builds UVs or a quad from it. Undefined unless 'ready'. */
  readonly size: ImageSize | undefined;
  readonly [DRAWN_TEXTURE]: {
    /** The view the material samples. Null unless 'ready'. */
    view: THREE.Texture | null;
    /** The CanvasTexture whose maps light the item. */
    canvasTexture: CanvasItemTexture | undefined;
  };
}

export function useCanvasMeshTexture(
  props: Pick<Node2DProperties, 'texture_filter' | 'texture_repeat'>,
  { reference, windowOf }: CanvasMeshTextureSlot
): CanvasMeshTexture {
  const {
    texture: source,
    size,
    missing,
    isArriving,
    hasNoImage,
    sampler,
    canvasTexture,
  } = useCanvasItemTexture(props, reference);
  const window = useMemo(
    () => windowOf?.({ source, size, hasNoImage: hasNoImage ?? false }) ?? null,
    [windowOf, source, size, hasNoImage]
  );
  const view = useWindowedCanvas2DTexture(source, sampler, window);
  const state = textureState(missing, view !== null, isArriving);
  return useMemo(
    () => ({
      state,
      size: state === 'ready' ? size : undefined,
      [DRAWN_TEXTURE]: { view: state === 'ready' ? view : null, canvasTexture },
    }),
    [state, size, view, canvasTexture]
  );
}

function textureState(missing: boolean, hasView: boolean, isArriving: boolean): CanvasMeshTextureState {
  if (missing) return 'missing';
  if (hasView) return 'ready';
  return isArriving ? 'arriving' : 'none';
}
