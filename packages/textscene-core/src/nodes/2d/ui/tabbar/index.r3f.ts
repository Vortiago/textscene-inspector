/** TabBar registration — native (WebGL canvas) painter + rect solver. */
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { TabBar } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'TabBar', Component: TabBar });

export { TabBar };
