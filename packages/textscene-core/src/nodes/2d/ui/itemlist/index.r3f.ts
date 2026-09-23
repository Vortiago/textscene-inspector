/** ItemList registration: native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import './nativeSolver';
import { ItemList } from './Component';

controlComponentRegistry.register({ typeName: 'ItemList', Component: ItemList });

export { ItemList };
