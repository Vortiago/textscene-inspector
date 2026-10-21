/** The glow parameters an Environment with glow enabled and `extra` properties builds. */

import { glowParamsFor, type GlowParams } from '../godotGlow';
import { environmentSettingsOf } from './environmentSettings';

export function glowOn(extra: Record<string, string> = {}): GlowParams {
  const params = glowParamsFor(environmentSettingsOf({ glow_enabled: 'true', ...extra }), true);
  if (!params) throw new Error('expected glow to be enabled');
  return params;
}
