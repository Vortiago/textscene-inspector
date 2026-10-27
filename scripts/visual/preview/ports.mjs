/**
 * The local port each harness serves the page its browser opens, and the variable that moves it.
 * One table, so two harnesses never share a default: `waitForServer` accepts any 200, so a harness
 * on a taken port would measure the other harness's build.
 */

const PREVIEW_PORTS = {
  visual: { port: 4317, envName: 'VISUAL_PORT' },
  parity: { port: 4319, envName: 'PARITY_PORT' },
  /** The sheet captures (`capture`, `recapture`, `capture-complex`), which never run together. */
  compareDocs: { port: 4321, envName: 'COMPARE_PORT' },
  compareAnimation: { port: 4323, envName: 'COMPARE_ANIMATION_PORT' },
  perf: { port: 4325, envName: 'PERF_PORT' },
  skyLayersGpu: { port: 4327, envName: 'GPU_GATE_PORT' },
  decalGpu: { port: 4337, envName: 'DECAL_GPU_PORT' },
  e2eWeb: { port: 4329, envName: 'E2E_WEB_PORT' },
  uniformVectors: { port: 4331, envName: 'UNIFORM_VECTORS_PORT' },
  rendererConsumer: { port: 4335, envName: 'RENDERER_CONSUMER_PORT' },
  showcase: { port: 4188, envName: 'SHOWCASE_PORT' },
};

/** The port `harness` serves on, its override or its default, and the name of that override. */
export function previewPort(harness) {
  const entry = PREVIEW_PORTS[harness];
  if (!entry) {
    throw new Error(`expected one of ${Object.keys(PREVIEW_PORTS).join(', ')}, got "${harness}"`);
  }
  return { port: Number(process.env[entry.envName]) || entry.port, portEnvName: entry.envName };
}
