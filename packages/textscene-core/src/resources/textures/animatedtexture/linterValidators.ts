import { classProperties } from '../../../godot/classdb/classProperty.js';
import { registerPropertyFacts } from '../../../godot/classdb/propertyDescriptor.js';
import { ANIMATED_TEXTURE_FRAMES as frames } from '../../../godot/scene/animatedTexture.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../linter/validators/indexedFamily.js';

const textures = classProperties(frames.owner).filter(
  ({ name }) => name.startsWith(frames.prefix) && name.endsWith('/texture')
);
registerPropertyFacts(frames.owner, {
  ...Object.fromEntries(textures.map(({ name }) => [name, { refusesSelfAt: 'animated_texture.cpp:133' }])),
  frames: { width: 'int32', setter: { cite: 'animated_texture.cpp:90' } },
  speed_scale: {
    float32: true,
    setter: { cite: 'animated_texture.cpp:166', min: { at: -1000 }, max: { at: 1000, exclusive: true } },
  },
});

const unknownFrame = indexedFamilyValidator({
  ...frames,
  leaves: {},
  unknownCode: 'UNKNOWN_ANIMATED_TEXTURE_FRAME',
  describes: 'AnimatedTexture frame',
});
unknownFrame.preferCaptured = true;
validatorRegistry.registerAll(frames.owner, { [`${frames.prefix}#/*`]: unknownFrame });
