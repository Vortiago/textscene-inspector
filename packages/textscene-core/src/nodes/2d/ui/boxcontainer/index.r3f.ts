/**
 * BoxContainer registration: the native (WebGL canvas) rect solve and painter.
 * Importing `./nativeSolver` registers the container-layout and minimum-size functions.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { BoxContainer } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'BoxContainer', Component: BoxContainer });

export { BoxContainer };
