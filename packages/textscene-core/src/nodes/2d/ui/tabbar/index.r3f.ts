/** TabBar registration: native painter and rect solver. */
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { TabBar } from './Component';
import './nativeSolver';
import './minimumSize';

controlComponentRegistry.register({ typeName: 'TabBar', Component: TabBar });
