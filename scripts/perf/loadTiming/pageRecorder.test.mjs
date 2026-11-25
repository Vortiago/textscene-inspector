import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPageRecorder } from './pageRecorder.mjs';

const PREFIX = '[test] ';

/** A WebGL2 class whose calls do nothing, new for each test, as the recorder wraps its prototype. */
function fakeGLClass() {
  return class {
    shaderSource() {}
    attachShader() {}
    useProgram() {}
    drawArrays() {}
    drawElements() {}
    drawArraysInstanced() {}
    drawElementsInstanced() {}
    readPixels() {}
    getError() {}
  };
}

let events;
let FakeGL;

beforeEach(() => {
  events = [];
  vi.spyOn(console, 'log').mockImplementation((line) => events.push(JSON.parse(line.slice(PREFIX.length))));
  FakeGL = fakeGLClass();
  vi.stubGlobal('WebGL2RenderingContext', FakeGL);
  vi.stubGlobal('window', { location: { search: '?fixture=lit.tscn' }, addEventListener() {} });
  vi.stubGlobal('document', { documentElement: {}, querySelector: () => null });
  vi.stubGlobal(
    'MutationObserver',
    class {
      observe() {}
    }
  );
  vi.stubGlobal(
    'PerformanceObserver',
    class {
      observe() {}
    }
  );
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

  it('records one first draw for each program, with its shader lengths', () => {
    const gl = new FakeGL();
    drawProgramTwice(gl, 12, 34);
    drawProgramTwice(gl, 5, 6);
    const draws = events.filter((event) => event.kind === 'first-draw');
    expect(draws.map((draw) => draw.shaderLengths)).toEqual([
      [12, 34],
      [5, 6],
    ]);
  });
});
