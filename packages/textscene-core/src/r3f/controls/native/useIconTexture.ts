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
 * It is tagged for the 2D canvas's sampling colour space, not a 3D
 * consumer's — see the tag's own comment below. This loader is wholly
 * separate from the `res://` resource pipeline, so nothing
 * `canvas2DTextureDecode.ts`'s `useCanvas2DTexture` does for a user-authored
 * image reaches an icon; the tag has to be applied here.
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
import { pinNoColorSpace } from '../../canvas2DTextureDecode';

export function useOptionalIconTexture(dataUrl: string | null): THREE.Texture | null {
  const texture = useMemo(() => {
    if (dataUrl === null) return null;
    // A theme icon is drawn by the 2D canvas and nothing else, so it wants the
    // canvas's sampling colour space rather than the sRGB tag a 3D consumer
    // needs: `rendering/viewport/hdr_2d` off (`rendering_server.cpp:3771`)
    // makes Godot's canvas bind the PLAIN, non-sRGB-typed GPU view of every
    // texture it samples (`texture_storage.cpp:754`), so its hardware
    // magnification filter blends the ENCODED bytes and the decode happens
    // after. `NoColorSpace` is what keeps WebGL from uploading this as
    // `SRGB8_ALPHA8` and decoding each texel BEFORE the filter — the opposite
    // order, and a visibly different ramp wherever an icon is magnified.
    // Pinned rather than assigned because these land on a `map` prop, which
    // `@react-three/fiber` re-tags `SRGBColorSpace` on every commit; the
    // matching post-filter decode is `useCanvasDecodeDefines`, which
    // `ControlQuad` already applies off this very tag.
    const tex = new THREE.TextureLoader().load(dataUrl);
    return pinNoColorSpace(tex);
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
