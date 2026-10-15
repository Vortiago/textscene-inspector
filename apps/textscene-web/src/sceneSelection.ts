/** Which built-in scene the app opens on, and how "none of them" is spelled. */

import { fixtures } from './fixturesAll';
import { IS_PUBLIC_SITE } from './siteEdition';

/** The fixture value while no fixture is active, on an uploaded .tscn. */
export const NO_FIXTURE = '';

/**
 * The first-visit default: a fixture with no `ext_resource` lines, so the first paint shows
 * a clean scene rather than missing-file warnings. The fallbacks keep the app off an
 * undefined fixture. The public edition opens on no scene, and its bundle names none.
 */
export const DEFAULT_FIXTURE = IS_PUBLIC_SITE
  ? NO_FIXTURE
  : (fixtures.find((f) => f.file === 'unit-plane-mesh.tscn')?.file ??
    fixtures.find((f) => f.file === 'integration-all-primitives.tscn')?.file ??
    fixtures[0]?.file ??
    NO_FIXTURE);
