/**
 * Timer parser — extends the Node base parse with the Timer property surface.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode } from '../../node/parser';
import { parseOptionalBool, parseOptionalFloat, parseOptionalInt } from '../../../parser/valueParsers';
import type { TimerProperties } from './types';

export function parseTimer(
  heading: ParsedHeading,
  properties: Record<string, string>
): TimerProperties {
  const baseProperties = parseNode(heading, properties);
  const result: TimerProperties = { ...baseProperties };

  const waitTime = parseOptionalFloat(properties.wait_time);
  if (waitTime !== undefined) result.wait_time = waitTime;

  const autostart = parseOptionalBool(properties.autostart);
  if (autostart !== undefined) result.autostart = autostart;

  const oneShot = parseOptionalBool(properties.one_shot);
  if (oneShot !== undefined) result.one_shot = oneShot;

  const paused = parseOptionalBool(properties.paused);
  if (paused !== undefined) result.paused = paused;

  const processCallback = parseOptionalInt(properties.process_callback);
  if (processCallback !== undefined) result.process_callback = processCallback;

  const ignoreTimeScale = parseOptionalBool(properties.ignore_time_scale);
  if (ignoreTimeScale !== undefined) result.ignore_time_scale = ignoreTimeScale;

  return result;
}
