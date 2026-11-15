/** Label registration: native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Label } from './Component';
import './solverRegistration';

controlComponentRegistry.register({ typeName: 'Label', Component: Label });
