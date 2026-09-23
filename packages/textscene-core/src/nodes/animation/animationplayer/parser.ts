/**
 * AnimationPlayer lenient parser for the renderer: playback configuration and clip names from the
 * raw properties. A plain Node: a Node3D below it finds no Node3D parent (node_3d.cpp:150,
 * `data.parent = Object::cast_to<Node3D>(get_parent())`), so the chain is `parseNode`, which
 * carries no `visible` or placement fields.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode } from '../../node/parser';
import { boolOr, enumOr, floatOr } from '../../../parser/valueParsers';
import { dictSubResourceEntries, literalText, resourceRef } from '../../../godot/index.js';
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
  const baseProps = parseNode(heading, properties);

  const libraries = extractLibraries(properties);

  return {
    ...baseProps,
    speed_scale: floatOr(properties.speed_scale, 1.0),
    playback_default_blend_time: floatOr(properties.playback_default_blend_time, 0.0),
    // Three `#ifndef DISABLE_DEPRECATED` keys forward into the canonical setter
    // (animation_player.cpp:54-61,93-100), so each pair below is one field. Only a 3.x scene
    // carries the deprecated spelling. Godot resolves a file holding both by line order, and this
    // prefers the canonical key.
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
 * Godot's `AnimationMixer::is_active()`: whether the mixer applies anything at all
 * (animation_mixer.cpp:2458). It defaults to true (animation_mixer.h:137), so Godot omits the key
 * unless it is false. `playback_active` is the same field. The semantic rule reads it through
 * this export, as the renderer does.
 */
export function isActive(properties: Record<string, string>): boolean {
  return boolOr(properties.active ?? properties.playback_active, true);
}

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

  // Dictionary form (Godot 4's serialisation), possibly multi-line:
  //   libraries = { "": SubResource("AnimationLibrary_x"), "combat": SubResource("…") }
  // Only inline SubResource libraries are captured; ExtResource entries point to
  // external (often binary .res) libraries the previewer cannot resolve.
  const dict = properties.libraries;
  if (dict !== undefined) {
    for (const { key, id } of dictSubResourceEntries(dict)) {
      libraries.push({ name: key, subResourceId: id });
    }
  }

  return libraries;
}
