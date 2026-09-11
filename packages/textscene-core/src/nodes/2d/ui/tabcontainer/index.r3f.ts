/** TabContainer registration — native (WebGL canvas) painter + rect solver. */
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { TabContainer } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'TabContainer', Component: TabContainer });

export { TabContainer };
