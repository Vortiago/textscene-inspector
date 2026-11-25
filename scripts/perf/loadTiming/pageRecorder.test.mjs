import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPageRecorder } from './pageRecorder.mjs';

const PREFIX = '[test] ';

const NoopObserver = class {
  observe() {}
};

let events;
let FakeGL;

beforeEach(() => {
  events = [];
  vi.spyOn(console, 'log').mockImplementation((line) => events.push(JSON.parse(line.slice(PREFIX.length))));
  // New for each test, as the recorder wraps the prototype it finds.
  FakeGL = class {
    shaderSource() {}
    attachShader() {}
    useProgram() {}
    drawArrays() {}
    drawElements() {}
    drawArraysInstanced() {}
    drawElementsInstanced() {}
    drawRangeElements() {}
    PACK_ROW_LENGTH = 0x0d02;
    PACK_SKIP_ROWS = 0x0d03;
    PACK_SKIP_PIXELS = 0x0d04;
    getExtension(name) {
      return name === 'WEBGL_multi_draw' ? { multiDrawElementsWEBGL() {} } : null;
    }
    pixelStorei(parameter, value) {
      this.pack = { ...this.pack, [parameter]: value };
    }
    getParameter(parameter) {
      return this.pack?.[parameter] ?? null;
    }
    bindFramebuffer() {}
    bindBuffer() {}
    readPixels() {}
  };
  vi.stubGlobal('WebGL2RenderingContext', FakeGL);
  const window = { location: { protocol: 'http:', search: '?fixture=lit.tscn' }, addEventListener() {} };
  window.top = window;
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', { documentElement: {}, getElementsByTagName: () => [] });
  vi.stubGlobal('MutationObserver', NoopObserver);
  vi.stubGlobal('PerformanceObserver', NoopObserver);
  installPageRecorder(PREFIX);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Links a program of shaders with the given source lengths, then draws it twice. */
function drawProgramTwice(gl, vertexLength, fragmentLength) {
  const [program, vertex, fragment] = [{}, {}, {}];
  gl.shaderSource(vertex, 'v'.repeat(vertexLength));
  gl.shaderSource(fragment, 'f'.repeat(fragmentLength));
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.useProgram(program);
  gl.drawElements();
  gl.drawElements();
}

describe('installPageRecorder', () => {
  it('records the navigation first', () => {
    expect(events[0]).toMatchObject({ kind: 'navigate', search: '?fixture=lit.tscn' });
  });

  it('records one first draw for each program', () => {
    const gl = new FakeGL();
    drawProgramTwice(gl, 12, 34);
    drawProgramTwice(gl, 5, 6);
    expect(events.filter((event) => event.kind === 'first-draw')).toHaveLength(2);
  });

  it('records the source length of each shader of the program drawn', () => {
    drawProgramTwice(new FakeGL(), 12, 34);
    expect(events.find((event) => event.kind === 'first-draw').shaderLengths).toEqual([12, 34]);
  });

  it('records the length of a shader whose source arrives after it is attached', () => {
    const gl = new FakeGL();
    const [program, shader] = [{}, {}];
    gl.attachShader(program, shader);
    gl.shaderSource(shader, 'v'.repeat(7));
    gl.useProgram(program);
    gl.drawArrays();
    expect(events.find((event) => event.kind === 'first-draw').shaderLengths).toEqual([7]);
  });

  it('keeps the program each context uses apart', () => {
    const [main, other] = [new FakeGL(), new FakeGL()];
    main.useProgram({});
    other.useProgram({});
    other.drawArrays();
    main.drawArrays();
    expect(events.filter((event) => event.kind === 'first-draw')).toHaveLength(2);
  });

  it('records the first draw of a program drawn through the multi-draw extension', () => {
    const gl = new FakeGL();
    const program = {};
    gl.useProgram(program);
    gl.getExtension('WEBGL_multi_draw').multiDrawElementsWEBGL();
    expect(events.filter((event) => event.kind === 'first-draw')).toHaveLength(1);
  });

  it('puts back the pack state it zeroes for its read', () => {
    const gl = new FakeGL();
    gl.pixelStorei(gl.PACK_ROW_LENGTH, 7);
    gl.useProgram({});
    gl.drawRangeElements();
    expect(gl.getParameter(gl.PACK_ROW_LENGTH)).toBe(7);
  });
});
