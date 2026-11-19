// @vitest-environment node
import { createHash } from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import { describe, expect, it } from 'vitest';
import { fastNoiseLiteOf } from '../../resources/noise/fastnoiselite/fastNoiseLite.testkit';
import { decodeNoiseTexture2D } from '../../resources/textures/noisetexture2d/decode';
import {
  NOISE_PIXEL_CASES,
  PINNED_LEVEL_HASHES,
  levelHashes,
} from '../../resources/textures/noisetexture2d/pixelCases.testkit';
import { installWorkerJobs, type WorkerJobScope } from '../workerEntry';
import { buildWorkerSource } from './buildWorkerSource.mjs';
import { TEXTURE_WORKER_MODULE, textureWorkerPlugin } from './esbuildPlugin.mjs';

/** A seamless ridged field, as core's decoders give it: the job input is plain data. */
const NOISE_JOB_INPUT = {
  tex: {
    width: 33,
    height: 17,
    invert: false,
    normalize: true,
    seamless: true,
    seamlessBlendSkirt: 0.1,
    asNormalMap: false,
    bumpStrength: 8,
    generateMipmaps: true,
    noise: null,
    colorRamp: null,
  },
  noise: {
    noiseType: 1,
    seed: 7,
    frequency: 0.08,
    offset: { x: 0, y: 0, z: 0 },
    fractalType: 2,
    fractalOctaves: 5,
    fractalLacunarity: 2,
    fractalGain: 0.5,
    fractalWeightedStrength: 0,
    fractalPingPongStrength: 2,
    cellularDistanceFunction: 0,
    cellularReturnType: 1,
    cellularJitter: 1,
    domainWarpEnabled: false,
    domainWarpType: 0,
    domainWarpAmplitude: 30,
    domainWarpFrequency: 0.05,
    domainWarpFractalType: 1,
    domainWarpFractalOctaves: 5,
    domainWarpFractalLacunarity: 6,
    domainWarpFractalGain: 0.5,
  },
  colorRamp: null,
};

interface Reply {
  ok: boolean;
  output: { levels: { data: Uint8Array }[] };
}

/** Sends one noise job to a worker scope and returns its reply. */
function answer(install: (scope: WorkerJobScope) => void, input: unknown = NOISE_JOB_INPUT): Reply {
  let reply: Reply | undefined;
  let onMessage: ((event: { data: unknown }) => void) | undefined;
  install({
    addEventListener: (_type, listener) => {
      onMessage = listener;
    },
    postMessage: (data) => {
      reply = data as Reply;
    },
  });
  onMessage?.({ data: { id: 1, job: 'noise-texture-2d', input } });
  if (!reply) throw new Error('expected the worker to answer the job, it did not');
  return reply;
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Installs `source`, a worker script, on `self` in a context of its own. */
const runScript = (source: string) => (self: WorkerJobScope) =>
  vm.runInNewContext(source, { self, Math, Float32Array, Uint8Array, Int32Array, Error, RangeError });

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '../../..');

/** The worker source exactly as a bundle embeds it, and the worker bundle's metafile. */
async function buildWorker(): Promise<{ source: string; metafile: esbuild.Metafile }> {
  let metafile: esbuild.Metafile = { inputs: {}, outputs: {} };
  const result = await esbuild.build({
    stdin: {
      contents: `import source from '${TEXTURE_WORKER_MODULE}'; globalThis.__source = source;`,
      resolveDir: PACKAGE_ROOT,
    },
    absWorkingDir: PACKAGE_ROOT,
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    plugins: [
      textureWorkerPlugin({
        minify: false,
        onMetafile: (workerMetafile) => {
          metafile = workerMetafile;
        },
      }),
    ],
    logLevel: 'silent',
  });
  const sandbox: { __source?: string } = {};
  vm.runInNewContext(result.outputFiles[0]!.text, { globalThis: sandbox });
  if (typeof sandbox.__source !== 'string')
    throw new Error('expected the bundle to embed a worker source string');
  return { source: sandbox.__source, metafile };
}

describe('textureWorkerPlugin', () => {
  it('embeds a worker script with no import or require left in it', async () => {
    const { source } = await buildWorker();
    expect(source).not.toMatch(/\bimport\s*[({'"]/);
    expect(source).not.toMatch(/\brequire\(/);
  }, 60_000);

  it("embeds a worker that answers a noise job with the bytes core's own job gives", async () => {
    const { source } = await buildWorker();
    const embedded = answer(runScript(source));
    const inProcess = answer(installWorkerJobs);

    expect(embedded.ok).toBe(true);
    expect(embedded.output.levels).toHaveLength(6);
    expect(embedded.output.levels[0]!.data).toHaveLength(33 * 17 * 4);
    expect(embedded.output.levels.map(({ data }) => sha256(data))).toEqual(
      inProcess.output.levels.map(({ data }) => sha256(data))
    );
  }, 60_000);

  it('hands over the metafile of the worker bundle, which lists the worker entry', async () => {
    const { metafile } = await buildWorker();
    expect(Object.keys(metafile.inputs)).toContain('src/workers/workerScript.ts');
  }, 60_000);
});

describe('the shipped worker script', () => {
  it('answers every pinned NoiseTexture2D case with the bytes Godot gives', async () => {
    const { text } = await buildWorkerSource({ workingDir: PACKAGE_ROOT, minify: true });
    for (const { name, tex, noise, colorRamp } of NOISE_PIXEL_CASES) {
      const reply = answer(runScript(text), { tex, noise, colorRamp });
      expect({ name, hashes: levelHashes(reply.output.levels) }).toEqual({
        name,
        hashes: PINNED_LEVEL_HASHES[name],
      });
    }
  }, 60_000);

  it.each([
    { seed: '1', width: '64', height: '48' },
    { seed: '42', width: '128', height: '1' },
    { seed: '9001', width: '17', height: '96' },
  ])(
    'answers seed $seed at $width x $height with the bytes of the in-thread job',
    async ({ seed, ...size }) => {
      const { text } = await buildWorkerSource({ workingDir: PACKAGE_ROOT, minify: true });
      const input = {
        tex: decodeNoiseTexture2D({ ...size, seamless: 'true' }),
        noise: fastNoiseLiteOf({ seed, frequency: '0.05', fractal_type: '1' }),
        colorRamp: null,
      };
      expect(levelHashes(answer(runScript(text), input).output.levels)).toEqual(
        levelHashes(answer(installWorkerJobs, input).output.levels)
      );
    },
    60_000
  );
});
