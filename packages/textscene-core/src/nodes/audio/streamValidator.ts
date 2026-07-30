/**
 * Shared audio `stream` linter validator — requires an `ExtResource(...)` or
 * `SubResource(...)` reference, else emits INVALID_STREAM_FORMAT. Shared by the
 * AudioStreamPlayer2D / 3D linters (the plain player keeps `v.resourceReference`;
 * the parse-side preserves the reference verbatim).
 */

import { propertyError } from '../../linter/validators/index.js';
import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';

export const streamValidator: PropertyValidator = (key, value, line) => {
  if (!value.startsWith('ExtResource(') && !value.startsWith('SubResource(')) {
    return propertyError(key, line, `Property 'stream' must be a resource reference (ExtResource or SubResource), got: "${value}"`, 'INVALID_STREAM_FORMAT');
  }
  return null;
};

// Shown in each sheet's generated `## Linting` table.
streamValidator.accepts = 'SubResource("id") or ExtResource("id")';
