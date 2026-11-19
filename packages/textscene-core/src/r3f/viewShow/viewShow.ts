/** The editor helpers a view draws, named after Godot's editor toggle where Godot has one. */
export interface ViewShow {
  /** View Grid (`node_3d_editor_plugin.cpp:6257`). */
  grid: boolean;
  /** View Gizmos (`node_3d_editor_plugin.cpp:6255`). Collision gizmos follow `collisions` alone. */
  gizmos: boolean;
  /** Visible Collision Shapes (`debugger_editor_plugin.cpp:71`). */
  collisions: boolean;
  labels: boolean;
  /** Visible Navigation (`debugger_editor_plugin.cpp:77`). */
  navigation: boolean;
  /** The preview sunlight button (`node_3d_editor_plugin.cpp:9905`). A scene's own light wins (ADR-0025). */
  previewSun: boolean;
  /** The preview environment button (`node_3d_editor_plugin.cpp:9916`). A scene's own environment wins. */
  previewEnvironment: boolean;
  /** The Environment's depth and volumetric fog. Off skips its passes. */
  fog: boolean;
  /** The frame time panel over the view, as View Frame Time (`node_3d_editor_plugin.cpp:6259`). */
  performance: boolean;
}

/** The grid is off, unlike Godot's (`node_3d_editor_plugin.cpp:6268`), or it lands in every golden. */
export const DEFAULT_SHOW: ViewShow = {
  grid: false,
  gizmos: true,
  collisions: false,
  labels: true,
  navigation: true,
  previewSun: true,
  previewEnvironment: true,
  fog: true,
  performance: false,
};

/** The game draws no editor helper, and every Label3D and fog (`scene/main/scene_tree.h:142-144`). */
export const RUNNING_GAME_SHOW = {
  grid: false,
  gizmos: false,
  collisions: false,
  labels: true,
  navigation: false,
  previewSun: false,
  previewEnvironment: false,
  fog: true,
} as const satisfies Partial<ViewShow>;

/** `show` over `base`, key by key. A key set to `undefined` keeps its value, as if `show` left it out. */
export function withShown(base: ViewShow, show: Partial<ViewShow> | undefined): ViewShow {
  if (!show) return base;
  const shown = { ...base };
  for (const key of Object.keys(base) as (keyof ViewShow)[]) shown[key] = show[key] ?? base[key];
  return shown;
}

/** Throws for a key `ViewShow` does not have, or a value that is neither a boolean nor `undefined`. */
export function assertShow(show: Partial<ViewShow>): void {
  for (const [key, value] of Object.entries(show)) {
    if (!(key in DEFAULT_SHOW)) throw new Error(`expected a key of show, got "${key}"`);
    if (value !== undefined && typeof value !== 'boolean') {
      throw new Error(`expected show.${key} to be a boolean, got ${JSON.stringify(value)}`);
    }
  }
}
