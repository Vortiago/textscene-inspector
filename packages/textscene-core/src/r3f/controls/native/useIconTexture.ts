/**
 * Stable `THREE.Texture` handles for the vendored `data:` SVG icons of `themeIcons.ts`. A vendored
 * icon cannot fail to resolve, and `TextureLoader.load` returns a blank texture at once, so no
 * caller gates rendering on the load.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { pinNoColorSpace } from '../../canvas2DTextureDecode';
import { useUndecodedTexture } from '../../undecodedTexture';
import { useTexture2D } from '../../../resources/useTexture2D';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import type { ThemedIconRef } from './solveTree';

/**
 * Memoised on the URL and disposed on unmount or URL change. `null` allocates nothing: hook order
 * is fixed, so a conditionally drawn icon (the SplitContainer grabber, hidden by the default
 * `autohide`) would otherwise decode an image for a quad it never renders.
 */
export function useOptionalIconTexture(dataUrl: string | null): THREE.Texture | null {
  const texture = useMemo(() => {
    if (dataUrl === null) return null;
    // With `hdr_2d` off (`rendering_server.cpp:3771`) Godot's canvas samples the non-sRGB view
    // (`texture_storage.cpp:754`), so the filter blends encoded bytes. `NoColorSpace` stops a
    // `SRGB8_ALPHA8` upload that decodes first. Pinned, since fiber re-tags a `map` on each commit,
    // and `ControlQuad` applies the matching decode. The loader bypasses `res://`, so it tags here.
    const tex = new THREE.TextureLoader().load(dataUrl);
    return pinNoColorSpace(tex);
  }, [dataUrl]);
  useEffect(() => (texture ? () => texture.dispose() : undefined), [texture]);
  return texture;
}

/**
 * For a painter that always draws the icon, so the result is never null. Two names, not an
 * overload: the lint rules read an overload as a redeclaration.
 */
export function useIconTexture(dataUrl: string): THREE.Texture {
  return useOptionalIconTexture(dataUrl)!;
}

const NO_EXT_RESOURCES: readonly TscnExternalResource[] = [];
const NO_INT_RESOURCES: readonly TscnInternalResource[] = [];

/**
 * Draws the themed icon `SolveNode.icons[<name>]` (loaded through `res://`, retagged for the canvas
 * colour space) or the vendored default. Both hooks run each render and load nothing on null input,
 * so one GPU texture is held. A `missing` ref falls back, as `add_theme_icon_override` (`control.cpp`)
 * refuses an invalid icon. One still loading returns `null`: the vendored icon first would flash.
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
