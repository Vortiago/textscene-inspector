/**
 * Godot 4.6.3's Viewport positional shadow atlas settings: the root's project defaults, a Viewport's
 * own defaults, and what its setters store.
 */

import type { PositionalShadowAtlasSettings } from '../rendering/lights/positionalShadowAtlas.js';

/**
 * The root viewport's atlas side: `rendering/lights_and_shadows/positional_shadow/atlas_size`
 * defaults to 4096 (`scene/main/scene_tree.cpp:2130`, applied at `:2138`). A `.tscn` does not record
 * the project settings, so the default stands. The editor's 3D viewport takes the same setting
 * (`editor/scene/3d/node_3d_editor_plugin.cpp:3157`).
 */
const POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT = 4096;

/** A `Viewport`'s own atlas side, which a SubViewport keeps (`scene/main/viewport.h:305`). */
const VIEWPORT_POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT = 2048;

/**
 * The shadow count of each `PositionalShadowAtlasQuadrantSubdiv` value, from Disabled to 1024
 * Shadows (`scene/main/viewport.cpp:1420`).
 */
const POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS = [0, 1, 4, 16, 64, 256, 1024] as const;

/**
 * The quadrant subdivisions, as `PositionalShadowAtlasQuadrantSubdiv` values: 4, 4, 16 and 64
 * shadows. The root takes them from the project settings (`scene_tree.cpp:2133-2136`), and a
 * `Viewport` sets the same values itself (`viewport.cpp:5363-5366`).
 */
const POSITIONAL_SHADOW_QUADRANT_SUBDIV_DEFAULT = [2, 2, 3, 4] as const;

/** The root viewport's atlas at the project defaults. */
export const ROOT_POSITIONAL_SHADOW_ATLAS: PositionalShadowAtlasSettings = {
  size: POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT,
  quadrantShadows: POSITIONAL_SHADOW_QUADRANT_SUBDIV_DEFAULT.map(
    (subdiv) => POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS[subdiv]
  ),
};

/**
 * A viewport's atlas from its `positional_shadow_atlas_size` and `positional_shadow_atlas_quad_0` to
 * `_3`, each absent where the `.tscn` leaves the default. The server refuses a negative size
 * (`light_storage.cpp:2158`), and the setter a subdivision outside the enum
 * (`viewport.cpp:1412-1413`), so either keeps the default.
 */
export function viewportPositionalShadowAtlas(
  size: number | undefined,
  quadrantSubdivs: readonly (number | undefined)[]
): PositionalShadowAtlasSettings {
  const quadrantShadows = POSITIONAL_SHADOW_QUADRANT_SUBDIV_DEFAULT.map((fallback, quadrant) => {
    const subdiv = quadrantSubdivs[quadrant];
    const shadows =
      subdiv !== undefined && Number.isInteger(subdiv)
        ? POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS[subdiv]
        : undefined;
    return shadows ?? POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS[fallback];
  });
  const isServerSize = size !== undefined && Number.isFinite(size) && size >= 0;
  return { size: isServerSize ? size : VIEWPORT_POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT, quadrantShadows };
}
