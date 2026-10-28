/** The resource a theme item is held through, which decides whether Godot sets a ViewportTexture in it up. */

import type { TscnInternalResource } from '../../../parser/types';
import { perObject } from '../../../utils/perObject';
import type { ThemeResource } from './types';

const NEVER_LOCAL: Readonly<Record<string, string>> = { resource_local_to_scene: 'false' };

/**
 * `theme` as a holder: local to scene as its file says, or never for the project theme.
 *
 * @canonical The holder a Theme's icons and styles reach a texture through
 */
export const themeHolder = perObject((theme: ThemeResource): TscnInternalResource => ({
  id: '',
  type: 'Theme',
  data: theme.isOutsideScenes ? NEVER_LOCAL : theme.properties,
}));
