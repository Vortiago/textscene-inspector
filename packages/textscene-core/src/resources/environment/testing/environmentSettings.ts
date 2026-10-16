/** The settings an Environment with `properties` builds under Godot's default clear colour. */

import { decodeEnvironment } from '../decode';
import { createEnvironmentSettings } from '../build';
import { DEFAULT_CLEAR_COLOR } from '../../../godot/rendering/rendering';
import type { EnvironmentSettings } from '../types';

export function environmentSettingsOf(properties: Record<string, string>): EnvironmentSettings {
  return createEnvironmentSettings(decodeEnvironment(properties), DEFAULT_CLEAR_COLOR);
}
