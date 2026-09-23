/**
 * BaseButton registration: the native (WebGL canvas) painter. It has no solver,
 * because BaseButton overrides neither `get_minimum_size` nor a container layout.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { BaseButton } from './Component';

controlComponentRegistry.register({ typeName: 'BaseButton', Component: BaseButton });

export { BaseButton };
