/**
 * AnimationPlayer parser — lenient parser for the renderer.
 *
 * Extracts playback configuration and clip names from the raw TSCN
 * properties map. Clips are stored as `anims/<name> = SubResource(...)` keys.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { boolOr, enumOr, floatOr } from '../../../parser/valueParsers';
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
    playback_process_mode: enumOr(
      properties.playback_process_mode,
      AnimationProcessMode.IDLE,
      [AnimationProcessMode.PHYSICS, AnimationProcessMode.IDLE, AnimationProcessMode.MANUAL]
    ),
    method_call_mode: enumOr(
      properties.method_call_mode,
      MethodCallMode.DEFERRED,
      [MethodCallMode.DEFERRED, MethodCallMode.IMMEDIATE]
    ),
    playback_active: boolOr(properties.playback_active, true),
    autoplay: stripQuotes(properties.autoplay ?? ''),
    current_animation: stripQuotes(properties.current_animation ?? ''),
    current_animation_length: floatOr(properties.current_animation_length, 0.0),
    current_animation_position: floatOr(properties.current_animation_position, 0.0),
    root_node: properties.root_node ?? 'NodePath("..")',
    libraries,
  };
}

const SUB_RESOURCE_REF = /^SubResource\("([^"]+)"\)$/;
// Entries of the dictionary form `libraries = { "<name>": SubResource("id"), … }`.
// Only inline SubResource libraries are captured; ExtResource entries point to
// external (often binary .res) libraries the previewer can't resolve.
const DICT_LIBRARY_ENTRY = /"([^"]*)"\s*:\s*SubResource\("([^"]+)"\)/g;

export function extractLibraries(properties: Record<string, string>): AnimationLibraryRef[] {
  const libraries: AnimationLibraryRef[] = [];

  // Expanded slash form: `libraries/<name> = SubResource("id")`.
  for (const key of Object.keys(properties)) {
    if (!key.startsWith('libraries/')) continue;
    const raw = properties[key];
    if (raw === undefined) continue;
    const match = SUB_RESOURCE_REF.exec(raw.trim());
    if (!match || match[1] === undefined) continue;
    libraries.push({ name: key.slice('libraries/'.length), subResourceId: match[1] });
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

export function stripQuotes(raw: string): string {
  // Godot 4 prefixes StringName literals with `&` and NodePath literals with
  // `^` (e.g. `autoplay = &"spin"`); drop that before unquoting.
  return raw
    .trim()
    .replace(/^[&^]/, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}
