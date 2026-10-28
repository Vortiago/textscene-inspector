/**
 * Resolves a Control's StyleBox theme override (such as
 * `theme_override_styles/panel = SubResource("StyleBoxFlat_x")`) to a typed
 * `ResolvedStyleBox`, for the four StyleBox kinds Godot ships
 * (`scene/resources/style_box*.cpp`).
 */

import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { parseResourceReference, findSubResource } from '../../../resources/SubResourceResolver';
import type { StyleBoxFlatData } from './styleBoxFlat';
import { parseStyleBoxLine, type StyleBoxLineData } from './styleBoxLine';
import { parseStyleBoxTexture, type StyleBoxTextureData } from './styleBoxTexture';
import { decodeStyleBox, neutralStyleBox } from '../../../resources/styles/stylebox/decode';

// A line or texture box extends `StyleBoxFlatData`, so a consumer of
// `SolveNode.styleBoxes` reads its kind-correct `contentMargin` unchanged and
// `StyleBoxQuad.tsx` reads `styleBoxKind`. Its core draws nothing, so a consumer
// that bypasses `StyleBoxQuad` paints nothing rather than the wrong thing.
/** A resolved `theme_override_styles/*` slot naming a `StyleBoxLine`. */
export interface StyleBoxLineBox extends StyleBoxFlatData {
  styleBoxKind: 'line';
  line: StyleBoxLineData;
}

/** A resolved `theme_override_styles/*` slot naming a `StyleBoxTexture`. */
export interface StyleBoxTextureBox extends StyleBoxFlatData {
  styleBoxKind: 'texture';
  texture: StyleBoxTextureData;
}

/** Every StyleBox kind `parseStyleBox` resolves to. A bare `StyleBoxFlatData` covers both `StyleBoxFlat` and `StyleBoxEmpty`. */
export type ResolvedStyleBox = StyleBoxFlatData | StyleBoxLineBox | StyleBoxTextureBox;

/** Whether a resolved slot holds a `StyleBoxTexture`, the one kind whose tint is a multiply rather than a substitution. */
export function isStyleBoxTexture(box: ResolvedStyleBox): box is StyleBoxTextureBox {
  return (box as StyleBoxTextureBox).styleBoxKind === 'texture';
}

/**
 * Wraps a `StyleBoxLineData` that is not an override, such as
 * `defaultSeparatorStyleBoxLine`, in the shape a resolved override has, so
 * `<StyleBoxQuad>` and `separatorPlacementRect` take either.
 */
export function styleBoxLineBox(line: StyleBoxLineData): StyleBoxLineBox {
  return { ...neutralStyleBox(line.margin), styleBoxKind: 'line', line };
}

/** Wraps a `StyleBoxTextureData` in the shape a resolved override has. */
function styleBoxTextureBox(texture: StyleBoxTextureData): StyleBoxTextureBox {
  return { ...neutralStyleBox(texture.contentMargin), styleBoxKind: 'texture', texture };
}

/**
 * `null`, never a throw, means "no override": an absent, non-SubResource or
 * unknown ref, or a resource that is not a StyleBox. A StyleBoxEmpty is not
 * `null`: Godot returns a local override unconditionally, so it replaces the
 * chrome with nothing.
 */
export function parseStyleBox(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  holders: readonly TscnInternalResource[]
): ResolvedStyleBox | null {
  if (!ref) return null;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource) return null;

  if (resource.type === 'StyleBoxLine') {
    const line = parseStyleBoxLine(ref, internalResources);
    return line && styleBoxLineBox(line);
  }
  if (resource.type === 'StyleBoxTexture') {
    const texture = parseStyleBoxTexture(ref, externalResources, internalResources, holders);
    return texture && styleBoxTextureBox(texture);
  }
  return decodeStyleBox(resource.type, resource.data);
}
