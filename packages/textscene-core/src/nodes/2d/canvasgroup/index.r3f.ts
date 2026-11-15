/** CanvasGroup render registration: the slice's only importer of `./Component`. */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { CanvasGroup } from './Component';

nodeComponentRegistry.register({ typeName: 'CanvasGroup', Component: CanvasGroup, canvasItem: true });
