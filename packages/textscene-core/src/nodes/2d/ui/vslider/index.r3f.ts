/** VSlider registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { VSlider } from './Component';

controlComponentRegistry.register({ typeName: 'VSlider', Component: VSlider });

export { VSlider };
