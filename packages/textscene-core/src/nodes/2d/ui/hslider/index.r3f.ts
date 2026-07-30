/** HSlider registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { HSlider } from './Component';

controlComponentRegistry.register({ typeName: 'HSlider', Component: HSlider });

export { HSlider };
