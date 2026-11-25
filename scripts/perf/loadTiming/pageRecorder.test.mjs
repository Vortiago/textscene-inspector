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
    readPixels() {}
    getError() {}
  };
  vi.stubGlobal('WebGL2RenderingContext', FakeGL);
  vi.stubGlobal('window', { location: { search: '?fixture=lit.tscn' }, addEventListener() {} });
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
});
