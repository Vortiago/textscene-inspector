/** Where a GeometryInstance3D's `material_overlay` draws among three's objects. */

/**
 * The overlay's draw-order key. Any value above the 3D default (0) puts it after its own surface. 1
 * keeps it as close to that surface as three allows, since every step also steps it past unrelated
 * content at the same depth. Godot appends the overlay after the surface's own material chain.
 *
 * @canonical The draw order of a material overlay
 */
export const MATERIAL_OVERLAY_RENDER_ORDER = 1;
