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
  AnimationProcessMode,
  type AnimationPlayerProperties,
  MethodCallMode,
} from './types';

export function parseAnimationPlayer(
  heading: ParsedHeading,
  properties: Record<string, string>
): AnimationPlayerProperties {
  const baseProps = parseNode3D(heading, properties);

  const clips = extractClips(properties);

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
    clips,
  };
}

function extractClips(properties: Record<string, string>): Array<{ name: string }> {
  const clips: Array<{ name: string }> = [];
  for (const key of Object.keys(properties)) {
    if (key.startsWith('anims/')) {
      const name = key.slice('anims/'.length);
      if (name.length > 0) {
        clips.push({ name });
      }
    }
  }
  return clips;
}

function stripQuotes(raw: string): string {
  return raw.replace(/^["']|["']$/g, '').trim();
}
