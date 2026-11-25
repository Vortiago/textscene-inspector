/** The geometry attribute of the custom array `custom`, as a surface geometry holds it. */
export const customArrayAttribute = (custom: number) => `custom${custom}`;

/** The template attribute that reads the custom array `custom`. */
export const customArrayTemplateAttribute = (custom: number) => `${customArrayAttribute(custom)}_attrib`;

/** The lanes of one vertex of a custom array attribute: every format decodes to four floats. */
export const CUSTOM_ARRAY_LANES = 4;

/** The attribute that holds each vertex's index in its own surface, which `gl_VertexIndex` reads. */
export const VERTEX_ID_ATTRIBUTE = 'vertex_id_attrib';

/** The vertices a point quad draws: `point_coords` of `scene_forward_clustered.glsl:709`. */
export const QUAD_VERTICES = 6;
