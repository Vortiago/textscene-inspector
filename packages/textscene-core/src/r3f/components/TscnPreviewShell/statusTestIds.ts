/**
 * The test ids of the top-bar statuses a capture harness waits on. The harnesses cannot
 * import TypeScript, so `scripts/visual/preview/appContract.mjs` declares the same values,
 * and `previewServer.test.mjs` fails when they differ.
 */
export const TEXTURE_WORK_STATUS_TESTID = 'texture-work-status';
export const SCENE_LOAD_STATUS_TESTID = 'scene-load-status';
