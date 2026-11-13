/**
 * Stable `THREE.Texture` handles for the vendored `data:` SVG icons of `themeIcons.ts`. A vendored
 * icon cannot fail to resolve, and `TextureLoader.load` returns a blank texture at once, so no
 * caller gates rendering on the load.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { useOwnerCanvas2DTexture } from '../../canvas2DTextureDecode';
import { applyViewSampler } from '../../../resources/textures/textureView';
import { useCanvasItemViewSampler, useResolvedTextureSampler } from '../../canvasItemTextureSampler';
import { useNearestAnisotropy } from '../../nearestAnisotropy';
import { useDisposeOnRelease } from '../../useDisposeOnRelease';
import { referenceHeldBy } from '../../../resources/reading';
import { useTexture2D } from '../../../resources/useTexture2D';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { themeIconSource } from './themeIconSource';
import type { ThemedIconRef } from './solveTree';

/**
 * A vendored icon's pixels come from `themeIconSource` at the project's theme scale, sampled with the
 * owner's filter and repeat. `null` allocates nothing: hook order is fixed, so a conditionally drawn
 * icon (the SplitContainer grabber, hidden by the default `autohide`) would decode an image it never draws.
 */
export function useOptionalIconTexture(dataUrl: string | null): THREE.Texture | null {
  const viewSampler = useCanvasItemViewSampler(useResolvedTextureSampler());
  const { themeScale } = useProjectSettings();
  const texture = useMemo(() => {
    if (dataUrl === null) return null;
    // The loader bypasses `res://`, so the canvas sampler and its colour space go on here.
    return applyViewSampler(
      new THREE.TextureLoader().load(themeIconSource(dataUrl, themeScale)),
      viewSampler
    );
  }, [dataUrl, themeScale, viewSampler]);
  useDisposeOnRelease(texture);
  useNearestAnisotropy(texture);
  return texture;
}

/**
 * For a painter that always draws the icon, so the result is never null. Two names, not an
 * overload: the lint rules read an overload as a redeclaration.
 */
export function useIconTexture(dataUrl: string): THREE.Texture {
  return useOptionalIconTexture(dataUrl)!;
}

/**
 * Draws the themed icon `SolveNode.icons[<name>]` (loaded through `res://`, retagged for the canvas
 * colour space) or the vendored default. Both hooks run each render and load nothing on null input,
 * so one GPU texture is held. A `missing` ref falls back, as `add_theme_icon_override` (`control.cpp`)
 * refuses an invalid icon. One still loading returns `null`: the vendored icon first would flash.
 */
export function useNodeIcon(
  themed: ThemedIconRef | undefined,
  vendoredUrl: string | null
): THREE.Texture | null {
  const reference = useMemo(
    () => themed && referenceHeldBy(themed.ref, themed.resources, themed.isHeldLocally),
    [themed]
  );
  const themedResult = useTexture2D(reference ?? null);
  const themedTexture = useOwnerCanvas2DTexture(themed ? themedResult.texture : null);
  const themedWins = themed !== undefined && !themedResult.missing;
  const vendoredTexture = useOptionalIconTexture(themedWins ? null : vendoredUrl);
  return themedWins ? themedTexture : vendoredTexture;
}
