import { afterEach, describe, expect, it, vi } from 'vitest';
import { openScene } from '../scene/openScene';
import { EditableProvider } from '../resources/testing/hotReloadHarness';
import { NOISE_PIXEL_CASES } from '../resources/textures/noisetexture2d/pixelCases.testkit';
import { FakeWorker } from '../workers/fakeWorker.testkit';
import { resourcePipelineOf } from './sceneResourcePipeline';

const SOURCE = '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n';

/** The workers the page started, each answering its jobs as the bundled script does. */
const started: FakeWorker[] = [];

afterEach(() => {
  started.length = 0;
  vi.unstubAllGlobals();
});

function stubWorkerGlobal(): void {
  vi.stubGlobal(
    'Worker',
    class extends FakeWorker {
      constructor() {
        super();
        started.push(this);
      }
    }
  );
}

describe("an opened scene's resource pipeline", () => {
  it('builds a procedural texture in a worker that the package starts', async () => {
    stubWorkerGlobal();
    const [pixelCase] = NOISE_PIXEL_CASES;
    if (!pixelCase) throw new Error('expected a noise pixel case');
    const scene = openScene({ source: SOURCE, provider: new EditableProvider() });

    const job = resourcePipelineOf(scene).loader.jobRunner.run('noise-texture-2d', pixelCase);
    await vi.waitFor(() => expect(started[0]?.held).toHaveLength(1));
    started[0]!.respond();

    const { levels } = await job;
    expect(levels[0]?.data.length).toBe(pixelCase.tex.width * pixelCase.tex.height * 4);
  });

  it("stops listening to the provider's watch when the scene is disposed", () => {
    const provider = new EditableProvider();
    const scene = openScene({ source: SOURCE, provider });
    resourcePipelineOf(scene);
    expect(provider.watcherCount()).toBe(1);

    scene.dispose();

    expect(provider.watcherCount()).toBe(0);
  });
});
