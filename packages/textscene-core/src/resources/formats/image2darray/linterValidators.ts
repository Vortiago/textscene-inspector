/**
 * CompressedTexture2DArray property validation. Its one property, `load_path`, is
 * CompressedTextureLayered's Variant::STRING (`scene/resources/compressed_texture.cpp:829`), so the
 * `.tscn` literal is quoted. CompressedTexture2DArray adds none (`compressed_texture.h:189-194`).
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CompressedTextureLayered', {
  load_path: v.quotedString('load_path'),
});
