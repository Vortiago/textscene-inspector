import { describe, expect, it } from 'vitest';
import { checkDiagnostics } from './diagnostics.mjs';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';

const CLOCK_DEPRECATION = 'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.';
const REMOVED_TYPE_WARNING =
  'THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.';
const GL_DRIVER_STALL =
  '[.WebGL-0x9a40016ce00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): ' +
  'GPU stall due to ReadPixels';

/** The failures `checkDiagnostics` records for a load that logged only `warnings`. */
function warningFailures(warnings, options) {
  const gate = fakeGate();
  checkDiagnostics(gate, '[3D]', { ...CLEAN_LOAD, consoleWarnings: warnings }, options);
  return gate.failures;
}

describe('checkDiagnostics on console warnings', () => {
  it('accepts a warning a healthy load logs', () => {
    expect(warningFailures([CLOCK_DEPRECATION])).toEqual([]);
  });

  it('accepts an accepted warning that carries more text after the prefix', () => {
    expect(warningFailures([`${CLOCK_DEPRECATION} Raised on the first Canvas.`])).toEqual([]);
  });

  it('records a warning about a removed feature, naming it (error case)', () => {
    expect(warningFailures([REMOVED_TYPE_WARNING])).toEqual([
      `[3D] 1 unexpected console warning(s): ${REMOVED_TYPE_WARNING}`,
    ]);
  });

  it('records a message that only contains an accepted prefix (edge case)', () => {
    expect(warningFailures([`prefix ${CLOCK_DEPRECATION}`])).toHaveLength(1);
  });

  it('accepts the headless GL driver stall, whatever the context id', () => {
    expect(warningFailures([GL_DRIVER_STALL.replace('0x9a40016ce00', '0x7f00abcd')])).toEqual([]);
  });

  it('records a GL driver message that is not the known stall', () => {
    const otherDriverMessage = GL_DRIVER_STALL.replace('GPU stall due to ReadPixels', 'unknown error');
    expect(warningFailures([otherDriverMessage])).toHaveLength(1);
  });

  it('accepts a warning that the scenario expects', () => {
    expect(
      warningFailures([REMOVED_TYPE_WARNING], { expectedWarnings: [/PCFSoftShadowMap has been removed/] })
    ).toEqual([]);
  });
});

describe('checkDiagnostics', () => {
  it('records nothing for a load with no warning and no error', () => {
    const gate = fakeGate();
    checkDiagnostics(gate, '[3D]', CLEAN_LOAD);
    expect(gate.failures).toEqual([]);
  });
});
