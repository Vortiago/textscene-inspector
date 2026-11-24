import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkCameraPreview } from './cameraPreviewScenario.mjs';

const EDITOR = Array.from({ length: 16 }, (_, i) => (i % 5 === 0 ? 1 : 0));
const PREVIEW = Array.from({ length: 16 }, (_, i) => (i % 5 === 0 ? 1 : 0.5));
const MOVED = Array.from({ length: 16 }, (_, i) => (i % 5 === 0 ? 1 : 0.25));

/** What a healthy app measures: the preview holds still, and the editor view comes back. */
function passingRun() {
  return {
    editor: EDITOR,
    preview: PREVIEW,
    previewAfterNavigation: PREVIEW,
    editorAfterPreview: EDITOR,
    previewAgain: PREVIEW,
    editorAfterReset: EDITOR,
    editorAfterOrbitReset: EDITOR,
    freelook: { isPressedAfterClick: true, isPressedAfterEscape: false },
    diagnostics: CLEAN_LOAD,
  };
}

function failuresOf(run) {
  const gate = fakeGate();
  checkCameraPreview(gate, run);
  return gate.failures;
}

describe('checkCameraPreview', () => {
  it('passes a run whose preview holds still and whose editor view comes back', () => {
    expect(failuresOf(passingRun())).toEqual([]);
  });

  it('fails when the probe captured nothing', () => {
    expect(failuresOf({ ...passingRun(), editor: null }).join('\n')).toMatch(/never captured an upload/);
  });

  it('fails when the preview never left the editor camera', () => {
    expect(failuresOf({ ...passingRun(), preview: EDITOR }).join('\n')).toMatch(
      /left the view on the editor camera/
    );
  });

  it('fails when navigation moves the previewed camera', () => {
    expect(failuresOf({ ...passingRun(), previewAfterNavigation: MOVED }).join('\n')).toMatch(
      /navigation moved the previewed Camera3D/
    );
  });

  it('fails when ending the preview keeps the scene camera on screen', () => {
    expect(failuresOf({ ...passingRun(), editorAfterPreview: PREVIEW }).join('\n')).toMatch(
      /did not restore the editor camera/
    );
  });

  it('fails when a second preview shows a moved pose', () => {
    expect(failuresOf({ ...passingRun(), previewAgain: MOVED }).join('\n')).toMatch(/a second preview/);
  });

  it('fails when Reset Camera keeps the preview on screen', () => {
    expect(failuresOf({ ...passingRun(), editorAfterReset: PREVIEW }).join('\n')).toMatch(
      /Reset Camera left the preview/
    );
  });

  it('fails when Reset Camera leaves an orbit on screen', () => {
    expect(failuresOf({ ...passingRun(), editorAfterOrbitReset: MOVED }).join('\n')).toMatch(
      /Reset Camera left the orbit on screen/
    );
  });

  it('fails when a click on Freelook leaves it unpressed', () => {
    const freelook = { isPressedAfterClick: false, isPressedAfterEscape: false };
    expect(failuresOf({ ...passingRun(), freelook })).toEqual([
      '[camera preview] a click on Freelook did not press it',
    ]);
  });

  it('fails when Escape leaves Freelook pressed', () => {
    const freelook = { isPressedAfterClick: true, isPressedAfterEscape: true };
    expect(failuresOf({ ...passingRun(), freelook })).toEqual([
      '[camera preview] Escape left Freelook pressed',
    ]);
  });
});
