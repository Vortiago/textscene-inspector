/** Registers the OptionButton native painter and rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { OptionButton } from './Component';
import {
  isOptionButtonSizeDependent,
  optionButtonMinimumSize,
  optionButtonTextureSlots,
} from './nativeSolver';

controlComponentRegistry.register({ typeName: 'OptionButton', Component: OptionButton });
controlSolverRegistry.registerMinimumSize('OptionButton', optionButtonMinimumSize);
controlSolverRegistry.registerTextureSlots('OptionButton', optionButtonTextureSlots);
// With `fit_to_longest_item` off, a wrapping label's height depends on this node's own width, so
// the minimum reads `SolveContext.tentativeRect`, for such a node only.
controlSolverRegistry.registerSizeDependentMinimum('OptionButton', isOptionButtonSizeDependent);
