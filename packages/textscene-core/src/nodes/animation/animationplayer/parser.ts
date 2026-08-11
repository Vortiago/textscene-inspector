/**
 * AnimationPlayer parser — lenient parser for the renderer.
 *
 * Extracts playback configuration and clip names from the raw TSCN
 * properties map. Clips are stored as `anims/<name> = SubResource(...)` keys.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { boolOr, enumOr, floatOr } from '../../../parser/valueParsers';
import { literalText, resourceRef, SUB_RESOURCE_REF_BODY } from '../../../godot/index.js';
import {
  type AnimationLibraryRef,
  AnimationProcessMode,
  type AnimationPlayerProperties,
  MethodCallMode,
} from './types';

export function parseAnimationPlayer(
  heading: ParsedHeading,
  properties: Record<string, string>
): AnimationPlayerProperties {
  const baseProps = parseNode3D(heading, properties);

  const libraries = extractLibraries(properties);

  return {
    ...baseProps,
    speed_scale: floatOr(properties.speed_scale, 1.0),
    playback_default_blend_time: floatOr(properties.playback_default_blend_time, 0.0),
    // Three `#ifndef DISABLE_DEPRECATED` keys forward straight into the
    // canonical setter (animation_player.cpp:54-61,93-100), so each pair below
    // is ONE field, not two. `_get_property_list` never pushes the deprecated
    // spelling, so only a 3.x scene carries it; Godot resolves a file holding
    // both by line order, and preferring the canonical key is our choice for a
    // shape Godot never writes.
    callback_mode_process: enumOr(
      properties.callback_mode_process ?? properties.playback_process_mode,
      AnimationProcessMode.IDLE,
      [AnimationProcessMode.PHYSICS, AnimationProcessMode.IDLE, AnimationProcessMode.MANUAL]
    ),
    callback_mode_method: enumOr(
      properties.callback_mode_method ?? properties.method_call_mode,
      MethodCallMode.DEFERRED,
      [MethodCallMode.DEFERRED, MethodCallMode.IMMEDIATE]
    ),
    active: isActive(properties),
    autoplay: literalText(properties.autoplay ?? ''),
    current_animation: literalText(properties.current_animation ?? ''),
    current_animation_length: floatOr(properties.current_animation_length, 0.0),
    current_animation_position: floatOr(properties.current_animation_position, 0.0),
    root_node: properties.root_node ?? 'NodePath("..")',
    libraries,
  };
}

/**
 * Godot's `AnimationMixer::is_active()` — whether the mixer applies anything at
 * all (animation_mixer.cpp:2458, defaulting to true at animation_mixer.h:137,
 * so Godot omits the key unless it is false). `playback_active` is the same
 * field, per the deprecated-alias note above.
 *
 * Exported so the semantic rule reads the field the same way the renderer does.
 */
export function isActive(properties: Record<string, string>): boolean {
  return boolOr(properties.active ?? properties.playback_active, true);
}

// Entries of the dictionary form `libraries = { "<name>": SubResource("id"), … }`.
// Only inline SubResource libraries are captured; ExtResource entries point to
// external (often binary .res) libraries the previewer can't resolve.
//
// Built from the shared reference body: both patterns here were written without
// whitespace tolerance, so a padded `SubResource ("id")` that the linter passes
// yielded no library at all and the animations silently went missing.
const DICT_LIBRARY_ENTRY = new RegExp(`"([^"]*)"\\s*:\\s*${SUB_RESOURCE_REF_BODY}`, 'g');

export function extractLibraries(properties: Record<string, string>): AnimationLibraryRef[] {
  const libraries: AnimationLibraryRef[] = [];

  // Expanded slash form: `libraries/<name> = SubResource("id")`.
  for (const key of Object.keys(properties)) {
    if (!key.startsWith('libraries/')) continue;
    const raw = properties[key];
    if (raw === undefined) continue;
    const parsed = resourceRef(raw.trim());
    if (parsed?.kind !== 'SubResource') continue;
    libraries.push({ name: key.slice('libraries/'.length), subResourceId: parsed.id });
  }

  // Dictionary form (Godot 4's actual serialization), possibly multi-line:
  //   libraries = { "": SubResource("AnimationLibrary_x"), "combat": SubResource("…") }
  const dict = properties.libraries;
  if (dict !== undefined) {
    for (const match of dict.matchAll(DICT_LIBRARY_ENTRY)) {
      libraries.push({ name: match[1]!, subResourceId: match[2]! });
    }
  }

  return libraries;
}
