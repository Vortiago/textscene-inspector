/** The varying slots of a GL context, as Godot's GLES3 driver reads them (`config.cpp:117-121`). */
export function glVaryingSlots(gl: WebGL2RenderingContext): number {
  const vertexOutputs = gl.getParameter(gl.MAX_VERTEX_OUTPUT_COMPONENTS) as number;
  const fragmentInputs = gl.getParameter(gl.MAX_FRAGMENT_INPUT_COMPONENTS) as number;
  return Math.floor(Math.min(vertexOutputs, fragmentInputs) / 4);
}
