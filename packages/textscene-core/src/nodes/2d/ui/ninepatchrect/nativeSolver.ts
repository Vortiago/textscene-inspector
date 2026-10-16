/**
 * NinePatchRect's native rect solver, `get_minimum_size` (`scene/gui/nine_patch_rect.cpp:53-55`): the
 * margins summed per axis, whether or not a texture loaded, unlike TextureRect's `EXPAND_KEEP_SIZE`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { NinePatchRectProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';

export const ninePatchRectMinimumSize: MinimumSizeFn = (n): Vector2 => {
  const props = n.node.properties as NinePatchRectProperties;
  const left = props.patchMarginLeft ?? 0;
  const top = props.patchMarginTop ?? 0;
  const right = props.patchMarginRight ?? 0;
  const bottom = props.patchMarginBottom ?? 0;
  return { x: left + right, y: top + bottom };
};
