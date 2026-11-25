/** The geometry attribute of the custom array `custom`, as a surface geometry holds it. */
export const customArrayAttribute = (custom: number) => `custom${custom}`;

/** The template attribute that reads the custom array `custom`. */
export const customArrayTemplateAttribute = (custom: number) => `${customArrayAttribute(custom)}_attrib`;

/** The attribute that holds each vertex's index in its own surface, which `gl_VertexIndex` reads. */
export const VERTEX_ID_ATTRIBUTE = 'vertex_id_attrib';
