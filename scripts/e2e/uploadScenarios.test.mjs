import { describe, expect, it } from 'vitest';
import {
  checkUploadScenarios,
  INK_FLOOR,
  TEXTURE_PATH,
  UPLOADED_PATHS,
  UPLOADED_SCENE_NAME,
} from './uploadScenarios.mjs';

/** The gate shape the checks write to. */
function fakeGate() {
  const failures = [];
  return { failures, check: (condition, message) => !condition && failures.push(message) };
}

const CLEAN_LOAD = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] };
const TEXTURED_FRAME = Buffer.from('textured');
const PLACEHOLDER_FRAME = Buffer.from('placeholder');
const MISSING_TEXTURE_WARNING = `[FileEventBus] ❌ Failed: ${TEXTURE_PATH} (47.30ms) - File not found: ${TEXTURE_PATH}`;

function uploadedScene(overrides = {}) {
  return {
    label: UPLOADED_SCENE_NAME,
    stage: '2d',
    settleReason: null,
    frame: TEXTURED_FRAME,
    inkPixels: 21032,
    paths: UPLOADED_PATHS,
    resources: [],
    ...overrides,
  };
}

/** Three arms that each behaved as a healthy app does. */
function passingRun() {
  return {
    fileInput: { ...uploadedScene(), diagnostics: CLEAN_LOAD },
    drop: { ...uploadedScene(), hintShown: true, hintAfterDrop: false, diagnostics: CLEAN_LOAD },
    repeatedDrop: {
      sceneOnly: uploadedScene({
        frame: PLACEHOLDER_FRAME,
        resources: [{ state: 'missing', path: TEXTURE_PATH }],
      }),
      filled: uploadedScene({ resources: [{ state: 'uploaded', path: TEXTURE_PATH }] }),
      diagnostics: { ...CLEAN_LOAD, consoleWarnings: [MISSING_TEXTURE_WARNING] },
    },
  };
}

function failuresOf(run) {
  const gate = fakeGate();
  checkUploadScenarios(gate, run);
  return gate.failures;
}

describe('checkUploadScenarios', () => {
  it('records nothing for three healthy arms', () => {
    expect(failuresOf(passingRun())).toEqual([]);
  });

  it('records an upload that left the start fixture open', () => {
    const run = passingRun();
    run.fileInput = { ...run.fileInput, label: null, stage: '3d' };
    const failures = failuresOf(run);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toContain('[upload] the toolbar names "null"');
    expect(failures[1]).toContain('[upload] opened in the "3d" workspace');
  });

  it('records an upload that drew nothing', () => {
    const run = passingRun();
    run.fileInput = { ...run.fileInput, inkPixels: 12 };
    expect(failuresOf(run)).toEqual([
      `[upload] only 12 ink pixels, floor is ${INK_FLOOR}, so nothing rendered`,
    ]);
  });

  it('records a drop whose outliner lacks a node, naming it', () => {
    const run = passingRun();
    run.drop = { ...run.drop, paths: ['Uploaded', 'Uploaded/Left'] };
    const failures = failuresOf(run);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('[drop]');
    expect(failures[0]).toContain('missing: [Uploaded/Right]');
  });

  it('records a drop that never showed its hint, or kept it after the drop', () => {
    const run = passingRun();
    run.drop = { ...run.drop, hintShown: false, hintAfterDrop: true };
    const failures = failuresOf(run);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toContain('[drop] the drop hint did not show');
    expect(failures[1]).toContain('[drop] the drop hint still shows');
  });

  it('records a texture the batch did not match, as a missing row', () => {
    const run = passingRun();
    run.fileInput = { ...run.fileInput, resources: [{ state: 'missing', path: TEXTURE_PATH }] };
    const failures = failuresOf(run);
    expect(failures.some((f) => f.startsWith('[upload] the Resources tab lists'))).toBe(true);
  });

  it('records a scene that never settled', () => {
    const run = passingRun();
    run.drop = { ...run.drop, settleReason: 'never settled', frame: null, inkPixels: null };
    const failures = failuresOf(run);
    expect(failures.some((f) => f === '[drop] the canvas never settled: never settled')).toBe(true);
  });

  it('records a drop frame that differs from the file input frame', () => {
    const run = passingRun();
    run.drop = { ...run.drop, frame: Buffer.from('other') };
    const failures = failuresOf(run);
    expect(failures).toEqual(['[drop] draws a different frame from the same files picked in the file input']);
  });

  it('records a scene-only drop with no missing row for its texture', () => {
    const run = passingRun();
    run.repeatedDrop.sceneOnly = { ...run.repeatedDrop.sceneOnly, resources: [] };
    const failures = failuresOf(run);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('[repeated drop, scene only] the Resources tab lists []');
  });

  it('records a scene-only drop that draws the textured frame, so the texture came from elsewhere', () => {
    const run = passingRun();
    run.repeatedDrop.sceneOnly = { ...run.repeatedDrop.sceneOnly, frame: TEXTURED_FRAME };
    const failures = failuresOf(run);
    expect(failures).toEqual([
      '[repeated drop, scene only] draws the textured frame without the texture, so the texture came from elsewhere',
    ]);
  });

  it('records a texture drop that left the row missing', () => {
    const run = passingRun();
    run.repeatedDrop.filled = {
      ...run.repeatedDrop.filled,
      frame: PLACEHOLDER_FRAME,
      resources: [{ state: 'missing', path: TEXTURE_PATH }],
    };
    const failures = failuresOf(run);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toContain('[repeated drop, texture] the Resources tab lists [missing res://');
    expect(failures[1]).toBe(
      '[repeated drop, texture] draws a different frame from the same files picked in the file input'
    );
  });

  it('accepts the missing texture warning in the repeated drop only', () => {
    const run = passingRun();
    run.drop = { ...run.drop, diagnostics: { ...CLEAN_LOAD, consoleWarnings: [MISSING_TEXTURE_WARNING] } };
    const failures = failuresOf(run);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('[drop] 1 unexpected console warning(s)');
  });

  it('records any other warning in the repeated drop (edge case)', () => {
    const run = passingRun();
    run.repeatedDrop.diagnostics.consoleWarnings.push('something else');
    const failures = failuresOf(run);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('[repeated drop] 1 unexpected console warning(s): something else');
  });
});
