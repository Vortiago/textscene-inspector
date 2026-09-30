/**
 * The esbuild plugin that ships the webview's job worker as one script string.
 * The webview starts it from a blob URL, and the CSP (`worker-src blob:`, no
 * `connect-src`) lets that script fetch nothing, so it must import nothing.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import { describe, expect, it } from 'vitest';
import { installWorkerJobs, type WorkerJobScope } from '@textscene/core/worker';
import { TEXTURE_WORKER_MODULE, textureWorkerPlugin } from './textureWorkerPlugin.mjs';

/** A seamless ridged field, as core's decoders give it: the job input is plain data. */
const NOISE_JOB_INPUT = {
  tex: {
    width: 33, height: 17, invert: false, normalize: true, seamless: true, seamlessBlendSkirt: 0.1,
    asNormalMap: false, bumpStrength: 8, noise: null, colorRamp: null,
  },
  noise: {
    noiseType: 1, seed: 7, frequency: 0.08, offset: { x: 0, y: 0, z: 0 }, fractalType: 2,
    fractalOctaves: 5, fractalLacunarity: 2, fractalGain: 0.5, fractalWeightedStrength: 0,
    fractalPingPongStrength: 2, cellularDistanceFunction: 0, cellularReturnType: 1, cellularJitter: 1,
    domainWarpEnabled: false, domainWarpType: 0, domainWarpAmplitude: 30, domainWarpFrequency: 0.05,
    domainWarpFractalType: 1, domainWarpFractalOctaves: 5, domainWarpFractalLacunarity: 6,
    domainWarpFractalGain: 0.5,
  },
  colorRamp: null,
};

interface Reply {
  ok: boolean;
  output: { pixels: Uint8Array };
}

/** Sends one noise job to a worker scope and returns its reply. */
function answer(install: (scope: WorkerJobScope) => void): Reply {
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
  onMessage?.({ data: { id: 1, job: 'noise-texture-2d', input: NOISE_JOB_INPUT } });
  if (!reply) throw new Error('expected the worker to answer the job, it did not');
  return reply;
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const APP_ROOT = path.resolve(import.meta.dirname, '../..');

/** The worker source exactly as the webview bundle embeds it. */
async function builtWorkerSource(): Promise<string> {
  const result = await esbuild.build({
    stdin: {
      contents: `import source from '${TEXTURE_WORKER_MODULE}'; globalThis.__source = source;`,
      resolveDir: APP_ROOT,
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    plugins: [textureWorkerPlugin({ minify: false })],
    logLevel: 'silent',
  });
  const sandbox: { __source?: string } = {};
  vm.runInNewContext(result.outputFiles[0]!.text, { globalThis: sandbox });
  if (typeof sandbox.__source !== 'string') throw new Error('expected the bundle to embed a worker source string');
  return sandbox.__source;
}

describe('textureWorkerPlugin', () => {
  it('embeds a worker script with no import or require left in it', async () => {
    const source = await builtWorkerSource();
    expect(source).not.toMatch(/\bimport\s*[({'"]/);
    expect(source).not.toMatch(/\brequire\(/);
  }, 60_000);

  it('embeds a worker that answers a noise job with the bytes core\'s own job gives', async () => {
    const source = await builtWorkerSource();
    const embedded = answer((self) =>
      vm.runInNewContext(source, { self, Math, Float32Array, Uint8Array, Int32Array, Error, RangeError })
    );
    const inProcess = answer(installWorkerJobs);

    expect(embedded.ok).toBe(true);
    expect(embedded.output.pixels).toHaveLength(33 * 17 * 4);
    expect(sha256(embedded.output.pixels)).toBe(sha256(inProcess.output.pixels));
  }, 60_000);
});
