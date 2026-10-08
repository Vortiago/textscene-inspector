import type { GeometryInstance3DProperties } from '../geometryinstance3d/types';
import type { SpriteQuadProperties } from '../sprite3d/quadParser';

/**
 * The AnimatedSprite3D properties this previewer reads: its base's, and those that place its quad.
 * `sprite_frames`, `animation` and `frame` stay raw, since their order decides the frame.
 */
export type AnimatedSprite3DProperties = GeometryInstance3DProperties & SpriteQuadProperties;
