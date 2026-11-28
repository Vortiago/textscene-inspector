import { expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withPreviewBrowser } from './session.mjs';
import { ensureWebBuilt } from './webBuild.mjs';
import { killPreviewGroup } from './server.mjs';
import { REPO_ROOT } from './paths.mjs';

vi.mock('./paths.mjs', () => ({ REPO_ROOT: mkdtempSync(join(tmpdir(), 'preview-session-')) }));
vi.mock('./webBuild.mjs', () => ({ ensureWebBuilt: vi.fn() }));
vi.mock('./captureContext.mjs', () => ({ warmUpGLContext: vi.fn() }));
vi.mock('./server.mjs', () => ({
  assertPortFree: vi.fn(),
  startPreview: () => ({ proc: {}, baseUrl: 'http://localhost' }),
  waitForServer: vi.fn(),
  killPreviewGroup: vi.fn(),
}));

it('keeps the next build waiting until the server stops', async ({ onTestFinished }) => {
  onTestFinished(() => rmSync(REPO_ROOT, { recursive: true, force: true }));
  const capture = Promise.withResolvers();
  const started = Promise.withResolvers();
  const options = { port: 1, portEnvName: 'VISUAL_PORT', launchBrowser: () => ({ close: vi.fn() }) };
  const stopping = Promise.withResolvers();
  const stopped = Promise.withResolvers();
  killPreviewGroup.mockImplementationOnce(() => {
    stopping.resolve();
    return stopped.promise;
  });
  const first = withPreviewBrowser(options, () => {
    started.resolve();
    return capture.promise;
  });
  await started.promise;
  vi.stubEnv('HARNESS_LOCK_WAIT_MS', '0');
  onTestFinished(() => vi.unstubAllEnvs());
  const another = () => withPreviewBrowser(options, () => {});
  try {
    await expect(another()).rejects.toThrow(/lock held/);
    capture.resolve();
    await stopping.promise;
    await expect(another()).rejects.toThrow(/lock held/);
  } finally {
    capture.resolve();
    stopped.resolve();
    await first;
  }
  await another();
  expect(ensureWebBuilt).toHaveBeenCalledTimes(2);
});
