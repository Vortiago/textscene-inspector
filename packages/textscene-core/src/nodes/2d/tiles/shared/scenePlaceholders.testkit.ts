/**
 * The TileSet resources for the placeholder tests: scene tile 6 with no scene and tile 1 asking for
 * its placeholder, beside the scenes of the scene tile fixtures.
 */
import { SCENE_TILESET_RESOURCES } from './sceneTiles.testkit';

/** Tile 6 holds only `display_placeholder`, so it has no scene. Tile 1 has a scene and the flag. */
export const PLACEHOLDER_TILESET_RESOURCES = SCENE_TILESET_RESOURCES.replace(
  'scenes/5/scene = ExtResource("5")',
  'scenes/5/scene = ExtResource("5")\nscenes/6/display_placeholder = true\nscenes/1/display_placeholder = true'
);
