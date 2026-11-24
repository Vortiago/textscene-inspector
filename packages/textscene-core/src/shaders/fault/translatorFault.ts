/** The Godot text a transpiled material comes from. */
export interface ShaderSource {
  readonly text: string;
  /** The shader's path, or an empty string for a text with no file. */
  readonly file: string;
}

/** A program the GPU refuses for a text Godot accepts, so the translator is at fault, not the shader. */
export class TranslatorFault extends Error {
  constructor(
    readonly source: ShaderSource,
    /** The driver's link log, then the info log of each stage that has one. */
    readonly log: string
  ) {
    super(
      `The translator wrote GLSL that the GPU refused for ${source.file || 'a shader with no file'}, which Godot compiles. This is a fault of the translator, not of the shader. The driver's log: ${log}`
    );
    this.name = 'TranslatorFault';
  }
}

/** The program's link log and each shader's info log, as the driver gives them. */
export function driverLog(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): string {
  const logs = [
    ['program', gl.getProgramInfoLog(program)],
    ['vertex', gl.getShaderInfoLog(vertexShader)],
    ['fragment', gl.getShaderInfoLog(fragmentShader)],
  ] as const;
  return logs
    .filter(([, log]) => log?.trim())
    .map(([stage, log]) => `${stage}: ${log!.trim()}`)
    .join('\n');
}
