/** The fields of three's `WebGLProgram` the report names. */
export interface ProgramNames {
  readonly name: string;
  readonly type: string;
}

/** three's report of a refused program (r187 `WebGLProgram.js:15-80`, `:850-861`) for a replacing hook. */
export function shaderErrorReport(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  [vertexShader, fragmentShader]: readonly [WebGLShader, WebGLShader],
  names: ProgramNames | undefined
): string {
  return (
    `WebGLProgram: Shader Error ${gl.getError()} - VALIDATE_STATUS ${gl.getProgramParameter(program, gl.VALIDATE_STATUS)}\n\n` +
    `Material Name: ${names?.name}\n` +
    `Material Type: ${names?.type}\n\n` +
    `Program Info Log: ${gl.getProgramInfoLog(program)?.trim()}\n` +
    `${stageErrors(gl, vertexShader, 'vertex')}\n` +
    stageErrors(gl, fragmentShader, 'fragment')
  );
}

function stageErrors(gl: WebGL2RenderingContext, shader: WebGLShader, stage: string): string {
  const errors = (gl.getShaderInfoLog(shader) ?? '').trim();
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) && errors === '') return '';
  const errorLine = /ERROR: 0:(\d+)/.exec(errors);
  if (!errorLine) return errors;
  return `${stage.toUpperCase()}\n\n${errors}\n\n${sourceAround(gl.getShaderSource(shader) ?? '', Number(errorLine[1]))}`;
}

/** The lines of `source` from five before `errorLine` to six after, numbered from 1, with `>` on it. */
function sourceAround(source: string, errorLine: number): string {
  const lines = source.split('\n');
  const from = Math.max(errorLine - 6, 0);
  const to = Math.min(errorLine + 6, lines.length);
  return lines
    .slice(from, to)
    .map((text, index) => {
      const line = from + index + 1;
      return `${line === errorLine ? '>' : ' '} ${line}: ${text}`;
    })
    .join('\n');
}
