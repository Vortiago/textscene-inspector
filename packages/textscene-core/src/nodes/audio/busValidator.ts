/**
 * Shared audio `bus` linter validator — accepts a plain quoted string
 * ("Master") or Godot's StringName literal (&"Master"), else emits
 * INVALID_BUS_FORMAT. Shared by the AudioStreamPlayer / 2D / 3D linters
 * (the parse-side counterpart is `parseBus`).
 */

import { propertyError } from '../../linter/validators/index.js';
import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';

export const busValidator: PropertyValidator = (key, value, line) => {
  if (!value.startsWith('"') && !value.startsWith('&"')) {
    return propertyError(key, line, `Property 'bus' must be a string, got: "${value}"`, 'INVALID_BUS_FORMAT');
  }
  return null;
};
