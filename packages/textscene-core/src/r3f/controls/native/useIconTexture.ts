/**
 * A stable `THREE.Texture` handle for a vendored `data:` SVG icon from
 * `themeIcons.ts`.
 *
 * `TextureLoader.load` returns the texture synchronously — initially blank,
 * painted once the underlying `<img>` decodes, exactly like any
 * browser-loaded texture — so a caller never has to gate rendering on load
 * completion the way `TextureRect` does for a user-authored resource
 * that might genuinely be missing. A vendored icon is compiled into the
 * bundle, so it cannot fail to resolve.
 *
 * The texture is memoised on the URL and disposed on unmount or URL change:
 * it is a GPU resource, and every painter that draws a themed icon needs
 * exactly this lifecycle.
 *
 * Passing `null` yields `null` and allocates nothing. That exists because a
 * painter cannot put this call behind its own early return — hook order is
 * fixed — so a widget whose icon is conditionally drawn would otherwise decode
 * an image and hold a GPU texture for a quad it never renders. The
 * SplitContainers are exactly that case: `autohide` defaults true, so their
 * grabber icon is invisible in the common scene.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export function useOptionalIconTexture(dataUrl: string | null): THREE.Texture | null {
  const texture = useMemo(() => {
    if (dataUrl === null) return null;
    const tex = new THREE.TextureLoader().load(dataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [dataUrl]);
  useEffect(() => (texture ? () => texture.dispose() : undefined), [texture]);
  return texture;
}

/**
 * The unconditional case: a painter that always draws this icon. Non-null by
 * construction, so a caller needs no guard.
 *
 * Two names rather than one overloaded signature: overloads read as a
 * redeclaration to the lint rules, and the split says which case a painter is
 * in at its call site.
 */
export function useIconTexture(dataUrl: string): THREE.Texture {
  // Non-null input always yields a texture — see `useOptionalIconTexture`.
  return useOptionalIconTexture(dataUrl)!;
}
