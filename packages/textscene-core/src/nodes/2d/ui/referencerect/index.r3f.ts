/**
 * Registers the native (WebGL canvas) painter for ReferenceRect (ADR-0001). It
 * has no minimum-size solver: ReferenceRect keeps `Control::get_minimum_size`.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { ReferenceRect } from './Component';

controlComponentRegistry.register({ typeName: 'ReferenceRect', Component: ReferenceRect });

export { ReferenceRect };
