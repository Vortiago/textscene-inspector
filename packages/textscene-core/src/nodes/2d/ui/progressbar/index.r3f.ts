/**
 * Registers the native (WebGL canvas) painter for ProgressBar. Importing
 * `./nativeSolver` registers its minimum-size function.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { ProgressBar } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'ProgressBar', Component: ProgressBar });

export { ProgressBar };
