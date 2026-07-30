/**
 * A stable `THREE.Texture` handle for a vendored `data:` SVG icon from
 * `themeIcons.ts`.
 *
 * `TextureLoader.load` returns the texture synchronously — initially blank,
 * painted once the underlying `<img>` decodes, exactly like any
 * browser-loaded texture — so a caller never has to gate rendering on load
 * completion the way `TextureRectNative` does for a user-authored resource
 * that might genuinely be missing. A vendored icon is compiled into the
 * bundle, so it cannot fail to resolve.
 *
 * The texture is memoised on the URL and disposed on unmount or URL change:
 * it is a GPU resource, and every painter that draws a themed icon needs
 * exactly this lifecycle.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export function useIconTexture(dataUrl: string): THREE.Texture {
  const texture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(dataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [dataUrl]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
