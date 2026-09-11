/**
 * TextureProgressBar's native (WebGL canvas) rect solver —
 * `TextureProgressBar::get_minimum_size` (`texture_progress_bar.cpp:81-97`).
 * Registered via `controlSolverRegistry.registerMinimumSize`. Pure per-node
 * math, no THREE/React.
 *
 * The `!nine_patch_stretch` branch (`:86-96`) maxes THREE texture natural
 * sizes, but `SolveNode.textureSize` (`buildSolveTree.ts`'s own doc) is
 * populated from only ONE node property, checked by the LITERAL name
 * `texture`/`icon` — neither of which this type has (its three slots are
 * `texture_under`/`texture_progress`/`texture_over`), so it is always `null`
 * here. `inlineTexture2DSize` (`resources/useTexture2D.ts` — the SAME
 * function `buildSolveTree.ts` itself calls for the synchronously-knowable
 * cases) recovers an AtlasTexture cell's or a GradientTexture2D's own size
 * without it; a scene that instead points a slot at a plain image FILE still
 * floors to `(1, 1)` until `buildSolveTree.ts` is generalized to resolve one
 * of these three names (or, better, all three) the way it already does for
 * `texture`/`icon`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { controlSolverRegistry, type MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { inlineTexture2DSize } from '../../../../resources/useTexture2D';
import type { TextureProgressBarProperties } from './types';

export const TEXTURE_FILL_LEFT_TO_RIGHT = 0;
export const TEXTURE_FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE = 8;

/**
 * `set_fill_mode` (`texture_progress_bar.cpp:575-583`) `ERR_FAIL_INDEX`
 * REFUSES an out-of-range write, so the stored `mode` keeps its class
 * default (`FILL_LEFT_TO_RIGHT`, `texture_progress_bar.h:105`) rather than
 * becoming an invalid enum value.
 */
export function normalizeTextureProgressBarFillMode(fillMode: number | undefined): number {
  const mode = fillMode ?? TEXTURE_FILL_LEFT_TO_RIGHT;
  return mode >= TEXTURE_FILL_LEFT_TO_RIGHT && mode <= TEXTURE_FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE
    ? mode
    : TEXTURE_FILL_LEFT_TO_RIGHT;
}

export const textureProgressBarMinimumSize: MinimumSizeFn = (n) => {
  const props = n.node.properties as TextureProgressBarProperties;

  if (props.ninePatchStretch) {
    const left = props.stretchMarginLeft ?? 0;
    const right = props.stretchMarginRight ?? 0;
    const top = props.stretchMarginTop ?? 0;
    const bottom = props.stretchMarginBottom ?? 0;
    return { x: left + right, y: top + bottom };
  }

  let width = 1;
  let height = 1;
  const { internalResources } = n.resources;
  for (const ref of [props.textureUnder, props.textureProgress, props.textureOver]) {
    const size = inlineTexture2DSize(ref, internalResources);
    if (size) {
      width = Math.max(width, size.x);
      height = Math.max(height, size.y);
    }
  }
  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('TextureProgressBar', textureProgressBarMinimumSize);
