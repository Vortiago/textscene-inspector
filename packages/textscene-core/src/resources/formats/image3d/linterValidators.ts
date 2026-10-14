/**
 * CompressedTexture3D property validation. Its one property, `load_path`, is a Variant::STRING
 * (`scene/resources/compressed_texture.cpp:640`), so the `.tscn` literal is quoted.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CompressedTexture3D', {
  load_path: v.quotedString('load_path'),
});
