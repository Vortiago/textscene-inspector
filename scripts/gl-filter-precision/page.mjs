/* global document */

/** Each format's worst linear-filter error as a share of its pair's gap, or null without its extension. */
// Playwright sends only this function to the page, so every helper nests inside it.
export function filterPrecision() {
  /** Depth pairs in 16-bit steps. 255 and 256 differ only in the low byte. */
  const PAIRS = [
    [255, 256],
    [1000, 1001],
    [40000, 40255],
    [65279, 65280],
    [12345, 23456],
  ];
  const WEIGHTS = [0.25, 0.5, 0.75];
  const DEPTH_STEPS = 65535;

  const VERTEX = `#version 300 es
  in vec2 corner;
  void main() { gl_Position = vec4(corner, 0.0, 1.0); }`;

  function fragmentFor(decode) {
    return `#version 300 es
  precision highp float;
  uniform highp sampler2D texels;
  uniform float u;
  out vec4 depth;
  void main() {
    vec4 s = textureLod(texels, vec2(u, 0.5), 0.0);
    depth = vec4(${decode}, 0.0, 0.0, 1.0);
  }`;
  }

  function formatsOf(gl) {
    const floatLinear = gl.getExtension('OES_texture_float_linear');
    const norm16 = gl.getExtension('EXT_texture_norm16');
    const asUnit = (pair) => new Float32Array(pair.map((depth) => depth / DEPTH_STEPS));
    return {
      RG8: {
        internal: gl.RG8,
        format: gl.RG,
        type: gl.UNSIGNED_BYTE,
        texels: (pair) => new Uint8Array(pair.flatMap((depth) => [depth >> 8, depth & 255])),
        decode: 'dot(s.rg * 255.0, vec2(256.0, 1.0))',
      },
      R16F: { internal: gl.R16F, format: gl.RED, type: gl.FLOAT, texels: asUnit, decode: 's.r * 65535.0' },
      R32F: floatLinear && {
        internal: gl.R32F,
        format: gl.RED,
        type: gl.FLOAT,
        texels: asUnit,
        decode: 's.r * 65535.0',
      },
      R16: norm16 && {
        internal: norm16.R16_EXT,
        format: gl.RED,
        type: gl.UNSIGNED_SHORT,
        texels: (pair) => new Uint16Array(pair),
        decode: 's.r * 65535.0',
      },
    };
  }

  function program(gl, fragment) {
    const linked = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, fragment],
    ]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(linked, shader);
    }
    gl.bindAttribLocation(linked, 0, 'corner');
    gl.linkProgram(linked);
    return linked;
  }

  function drawTarget(gl) {
    gl.getExtension('EXT_color_buffer_float');
    const target = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 1, 1);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    gl.viewport(0, 0, 1, 1);
  }

  function fullScreenTriangle(gl) {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  function uploadPair(gl, format, pair) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      format.internal,
      2,
      1,
      0,
      format.format,
      format.type,
      format.texels(pair)
    );
    return texture;
  }

  /** The depth a linear sample at `weight` between the pair's two texels gives back. */
  function sampledDepth(gl, linked, weight) {
    gl.uniform1f(gl.getUniformLocation(linked, 'u'), (0.5 + weight) / 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixel = new Float32Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixel);
    return pixel[0];
  }

  /** The largest error of `format` over every pair and weight, as a share of the pair's depth gap. */
  function worstError(gl, format) {
    const linked = program(gl, fragmentFor(format.decode));
    gl.useProgram(linked);
    let worst = 0;
    for (const pair of PAIRS) {
      const texture = uploadPair(gl, format, pair);
      for (const weight of WEIGHTS) {
        const wanted = pair[0] + weight * (pair[1] - pair[0]);
        worst = Math.max(worst, Math.abs(sampledDepth(gl, linked, weight) - wanted) / (pair[1] - pair[0]));
      }
      gl.deleteTexture(texture);
    }
    return Number(worst.toFixed(4));
  }

  const gl = document.createElement('canvas').getContext('webgl2');
  drawTarget(gl);
  fullScreenTriangle(gl);
  return Object.fromEntries(
    Object.entries(formatsOf(gl)).map(([name, format]) => [name, format ? worstError(gl, format) : null])
  );
}
