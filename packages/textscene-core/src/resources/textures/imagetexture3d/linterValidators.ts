/**
 * ImageTexture3D property validation. Its one property, `_images`, holds the slices inline
 * (`scene/resources/image_texture.cpp:512`), and `_set_images` takes a `TypedArray<Image>`
 * (`:467`), which refuses an array typed otherwise.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('ImageTexture3D', {
  _images: v.arrayLiteral('_images', { typedAs: 'Image', enforced: 'image_texture.cpp:467' }),
});
