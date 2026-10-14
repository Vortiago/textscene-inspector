#!/usr/bin/env node
/**
 * Prints the fragment uniform vectors of the lit programs each measured scene compiles in the
 * visual harness's Chromium. Each program's fragment shader is linked again with a vertex shader
 * that only declares its outputs, so no vertex uniform counts, and its active non-sampler uniforms
 * are packed by GLSL ES 1.00 Appendix A.7 (`packing.mjs`). It is a tool, not a gate.
 *
 * @example
 *   node scripts/uniform-vectors/measure.mjs
 */

import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import {
  assertPortFree,
  ensureWebBuilt,
  findCanvas,
  gotoFixture,
  killPreviewGroup,
  settleCanvas,
  startPreview,
  VIEWPORT,
  waitForServer,
} from '../visual/previewServer.mjs';
import { measuredScene } from './scenes.mjs';
import { isSampler, packedVectors } from './packing.mjs';

/* global window, WebGL2RenderingContext */
// Both exist only in the browser that runs the `addInitScript` and `page.evaluate` callbacks.

// Clear of the visual harness's 4317 and the parity capture's 4319.
const PORT = Number(process.env.UNIFORM_VECTORS_PORT) || 4321;

/** A 3D scene that compiles no lit program, so every lit program comes from the upload. */
const START_FIXTURE = 'unit-empty-scene.tscn';

const CASES = [
  { label: '1', suns: 1, soft: false },
  { label: '8', suns: 8, soft: false },
  { label: '9', suns: 9, soft: false },
  { label: '1, soft', suns: 1, soft: true },
  { label: '8, soft', suns: 8, soft: true },
];

/** Records the sources of every program the page links, before the app's first draw. */
function recordLinkedPrograms() {
  const linked = [];
  Object.defineProperty(window, '__linkedPrograms', { value: linked });
  const proto = WebGL2RenderingContext.prototype;
  const sources = new WeakMap();
  const shadersOf = new WeakMap();
  const { shaderSource, attachShader, linkProgram } = proto;
  proto.shaderSource = function (shader, source) {
    sources.set(shader, source);
    return shaderSource.call(this, shader, source);
  };
  proto.attachShader = function (program, shader) {
    shadersOf.set(program, [...(shadersOf.get(program) ?? []), shader]);
    return attachShader.call(this, program, shader);
  };
  proto.linkProgram = function (program) {
    const stage = (type) =>
      sources.get(
        (shadersOf.get(program) ?? []).find((s) => this.getShaderParameter(s, this.SHADER_TYPE) === type)
      );
    linked.push({ gl: this, vertex: stage(this.VERTEX_SHADER), fragment: stage(this.FRAGMENT_SHADER) });
    return linkProgram.call(this, program);
  };
}

/**
 * The active uniforms of each lit fragment shader linked since `since`, with the vertex shader's
 * `main` emptied, and the sun shadow count it compiled for.
 */
function fragmentUniforms(since) {
  return window.__linkedPrograms
    .slice(since)
    .filter(({ fragment }) => fragment?.includes('#define STANDARD'))
    .map(({ gl, vertex, fragment }) => {
      const declaringVertex = `${vertex.slice(0, vertex.lastIndexOf('void main()'))}void main() { gl_Position = vec4( 0.0 ); }`;
      const program = gl.createProgram();
      for (const [type, source] of [
        [gl.VERTEX_SHADER, declaringVertex],
        [gl.FRAGMENT_SHADER, fragment],
      ]) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      const uniforms = Array.from({ length: count }, (_, index) => {
        const { type, size } = gl.getActiveUniform(program, index);
        return { type, size };
      });
      const sunShadows = Number(/SunLightShadow sunLightShadows\[ (\d+) \]/.exec(fragment)?.[1] ?? 0);
      return { uniforms, sunShadows, limit: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) };
    });
}

/** The highest packed vector count of the lit programs `scene` compiles, and their sun shadows. */
async function measure(browser, baseUrl, scene) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  try {
    await context.addInitScript(recordLinkedPrograms);
    const page = await context.newPage();
    await gotoFixture(page, baseUrl, START_FIXTURE);
    const { canvas, reason } = await findCanvas(page);
    if (!canvas) throw new Error(reason);
    const since = await page.evaluate(() => window.__linkedPrograms.length);
    await page
      .getByTestId('upload-tscn-input')
      .setInputFiles([{ name: 'measured.tscn', mimeType: 'text/plain', buffer: Buffer.from(scene) }]);
    const settled = await settleCanvas(page, canvas);
    if (!settled.buffer) throw new Error(settled.reason);
    const programs = await page.evaluate(fragmentUniforms, since);
    if (programs.length === 0) throw new Error('the scene compiled no lit program');
    const vectors = programs.map(({ uniforms }) =>
      packedVectors(uniforms.filter(({ type }) => !isSampler(type)))
    );
    return {
      vectors: Math.max(...vectors),
      sunShadows: Math.max(...programs.map(({ sunShadows }) => sunShadows)),
      limit: programs[0].limit,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  ensureWebBuilt();
  await assertPortFree(PORT, 'UNIFORM_VECTORS_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    console.log(
      '| Shadowed suns | `MeshStandardMaterial` | `MeshPhysicalMaterial` with five maps, clearcoat, a sky and fog |'
    );
    console.log('| --- | --- | --- |');
    let limit = 0;
    for (const { label, suns, soft } of CASES) {
      const standard = await measure(browser, baseUrl, measuredScene({ suns, soft, physical: false }));
      const physical = await measure(browser, baseUrl, measuredScene({ suns, soft, physical: true }));
      limit = standard.limit;
      const shadows = standard.sunShadows === suns ? '' : ` (${standard.sunShadows} sun shadows drawn)`;
      console.log(`| ${label}${shadows} | ${standard.vectors} | ${physical.vectors} |`);
    }
    console.log(`\nThis Chromium reports MAX_FRAGMENT_UNIFORM_VECTORS = ${limit}. WebGL 2 guarantees 224.`);
  } finally {
    await browser?.close();
    killPreviewGroup(proc);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
