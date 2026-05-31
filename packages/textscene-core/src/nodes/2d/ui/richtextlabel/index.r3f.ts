/** RichTextLabel registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { RichTextLabel } from './Component';

controlComponentRegistry.register({ typeName: 'RichTextLabel', Component: RichTextLabel });

export { RichTextLabel };
