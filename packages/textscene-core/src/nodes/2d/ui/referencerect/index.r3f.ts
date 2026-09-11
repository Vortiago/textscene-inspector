/**
 * ReferenceRect registration — the native (WebGL canvas) painter,
 * self-registered on import (ADR-0001). No minimum-size solver: ReferenceRect
 * does not override `Control::get_minimum_size`.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { ReferenceRect } from './Component';

controlComponentRegistry.register({ typeName: 'ReferenceRect', Component: ReferenceRect });

export { ReferenceRect };
