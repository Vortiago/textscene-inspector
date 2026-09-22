/**
 * TextureProgressBar's native (WebGL canvas) rect solver —
 * `TextureProgressBar::get_minimum_size` (`texture_progress_bar.cpp:81-97`).
 * Registered via `controlSolverRegistry.registerMinimumSize`. Pure per-node
 * math, no THREE/React.
 *
 * The `!nine_patch_stretch` branch (`:86-96`) maxes THREE texture natural
 * sizes — `texture_under`/`texture_progress`/`texture_over`, none of which is
 * the generic `texture`/`icon` name `buildSolveTree.ts` resolves by default —
 * so this type declares them via `controlSolverRegistry.registerTextureSlots`
 * (`textureProgressBarTextureSlots`) and reads the result back off
 * `SolveNode.textureSlots`, resolved by the walker the SAME way as any other
 * Texture2D ref: inline, an `ExtResource(AtlasTexture)` `.tres`, or a loaded
 * image file alike.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { TscnNode } from '../../../../parser/types';
import {
  controlSolverRegistry,
  type MinimumSizeFn,
  type TextureSlotRequest,
  type TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import type { TextureProgressBarProperties } from './types';

/** The keys `textureProgressBarTextureSlots`/`textureProgressBarMinimumSize` share for `SolveNode.textureSlots`. */
export const TEXTURE_UNDER_KEY = 'texture_under';
export const TEXTURE_PROGRESS_KEY = 'texture_progress';
export const TEXTURE_OVER_KEY = 'texture_over';

/** `TextureProgressBar`'s own three Texture2D properties (`texture_progress_bar.h:38-40`). */
export const textureProgressBarTextureSlots: TextureSlotsFn = (node: TscnNode) => {
  const props = node.properties as TextureProgressBarProperties;
  const requests: TextureSlotRequest[] = [];
  if (props.textureUnder) requests.push({ key: TEXTURE_UNDER_KEY, ref: props.textureUnder });
  if (props.textureProgress) requests.push({ key: TEXTURE_PROGRESS_KEY, ref: props.textureProgress });
  if (props.textureOver) requests.push({ key: TEXTURE_OVER_KEY, ref: props.textureOver });
  return requests;
};

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
  for (const key of [TEXTURE_UNDER_KEY, TEXTURE_PROGRESS_KEY, TEXTURE_OVER_KEY]) {
    const size = n.textureSlots[key];
    if (size) {
      width = Math.max(width, size.x);
      height = Math.max(height, size.y);
    }
  }
  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('TextureProgressBar', textureProgressBarMinimumSize);
controlSolverRegistry.registerTextureSlots('TextureProgressBar', textureProgressBarTextureSlots);
