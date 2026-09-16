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
import { useUndecodedTexture } from '../../undecodedTexture';
import { useTexture2D } from '../../../resources/useTexture2D';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import type { ThemedIconRef } from './solveTree';

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

const NO_EXT_RESOURCES: readonly TscnExternalResource[] = [];
const NO_INT_RESOURCES: readonly TscnInternalResource[] = [];

/**
 * The one call a painter needs to draw EITHER a themed icon or its vendored
 * default — never both, and never a conditional hook call (hook order is
 * fixed, so a painter cannot branch between `useTexture2D` and
 * `useOptionalIconTexture` itself; this hook makes that branch internally).
 *
 * `themed` is `SolveNode.icons[<name>]` — present when a local
 * `theme_override_icons/<name>` or an ancestor/project Theme resolved this
 * icon (`solveTree.ts`'s own doc). When present it wins UNCONDITIONALLY,
 * exactly like `Control::get_theme_icon`'s local-override branch and the
 * ancestor-chain walk both do — the theme's own referenced texture is
 * loaded through the ordinary `res://` pipeline (`useTexture2D`), not the
 * vendored data-URL one, and retagged for the 2D canvas's sampling colour
 * space (`useUndecodedTexture`) exactly like `TextureRect`'s own texture is.
 *
 * A themed ref that fails to resolve (`missing`) falls back to `vendoredUrl`
 * — `Control::_set`'s NIL branch removes an icon override whose Ref failed
 * to validate (`add_theme_icon_override`'s `ERR_FAIL_COND(!p_icon.is_valid())`,
 * `control.cpp`), so a broken theme reference is faithfully "no override",
 * not "no icon at all". While a themed ref is still loading (`missing` false,
 * `texture` null), this returns `null` rather than the vendored icon:
 * showing the vendored icon and then swapping would be a visible flash a
 * synchronous engine load never produces.
 *
 * Both underlying hooks are called UNCONDITIONALLY on every render — each
 * already degrades to "load nothing" on its own null/undefined input — so
 * this satisfies the fixed-hook-order rule while still allocating only ONE
 * GPU texture at a time.
 */
export function useNodeIcon(themed: ThemedIconRef | undefined, vendoredUrl: string | null): THREE.Texture | null {
  const themedResult = useTexture2D(
    themed?.ref,
    themed?.resources.externalResources ?? NO_EXT_RESOURCES,
    themed?.resources.internalResources ?? NO_INT_RESOURCES
  );
  const themedTexture = useUndecodedTexture(themed ? themedResult.texture : null);
  const themedWins = themed !== undefined && !themedResult.missing;
  const vendoredTexture = useOptionalIconTexture(themedWins ? null : vendoredUrl);
  return themedWins ? themedTexture : vendoredTexture;
}
