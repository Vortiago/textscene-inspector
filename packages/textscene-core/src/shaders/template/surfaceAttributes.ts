/** The geometry attribute of the custom array `custom`, as a surface geometry holds it. */
export const customArrayAttribute = (custom: number) => `custom${custom}`;

/** The template attribute that reads the custom array `custom`. */
export const customArrayTemplateAttribute = (custom: number) => `${customArrayAttribute(custom)}_attrib`;

/** The custom arrays the canvas template reads: CUSTOM0 and CUSTOM1 (`canvas.glsl:12-18`). */
export const CANVAS_CUSTOM_ARRAYS = [0, 1] as const;

/** The lanes of one vertex of a custom array attribute: every format decodes to four floats. */
export const CUSTOM_ARRAY_LANES = 4;

/** A vertex format of fewer than four lanes reads 0 for a missing lane and 1 for a missing alpha. */
export const MISSING_CUSTOM_LANES = [0, 0, 0, 1] as const;

/** The attribute that holds each vertex's index in its own surface, which `gl_VertexIndex` reads. */
export const VERTEX_ID_ATTRIBUTE = 'vertex_id_attrib';

/** The vertices a point quad draws: `point_coords` of `scene_forward_clustered.glsl:709`. */
export const QUAD_VERTICES = 6;
