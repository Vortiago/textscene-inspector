/**
 * OpenXRRenderModel owns zero validatable properties. Its one member, the RID `render_model`,
 * serialises, but only the render-model manager sets it, on children no saved scene holds.
 * `openXRRenderModel.md` gives the engine lines.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('OpenXRRenderModel', {});
