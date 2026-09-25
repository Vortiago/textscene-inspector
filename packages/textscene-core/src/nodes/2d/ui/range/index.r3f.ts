/**
 * Registers the native (WebGL canvas) painter for Range. It registers no
 * solver: Range overrides neither `get_minimum_size` nor any container layout.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Range } from './Component';

controlComponentRegistry.register({ typeName: 'Range', Component: Range });

export { Range };
