/** PanelContainer registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { PanelContainer } from './Component';

controlComponentRegistry.register({ typeName: 'PanelContainer', Component: PanelContainer });

export { PanelContainer };
