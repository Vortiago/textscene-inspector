import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// A Cubemap declares no property of its own (`image_texture.cpp:537`): its faces are ImageTextureLayered's.
validatorRegistry.registerAll('ImageTextureLayered', {
  _images: v.arrayLiteral('_images', { typedAs: 'Image', enforced: 'image_texture.cpp:278' }),
});
