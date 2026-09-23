/**
 * Shared audio `bus` linter validator. A bus name is a StringName, so Godot
 * saves it as `&"Master"` while a hand-written scene may carry plain
 * `"Master"`, and `v.stringName` accepts both. The parse-side counterpart is
 * `parseBus`. Shared by the AudioStreamPlayer / 2D / 3D linters.
 */

import { v } from '../../linter/validators/index.js';
import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';

export const busValidator: PropertyValidator = v.stringName('bus');
