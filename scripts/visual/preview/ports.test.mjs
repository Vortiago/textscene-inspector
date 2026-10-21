import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewPort } from './ports.mjs';

const HARNESSES = [
  'visual',
  'parity',
  'compareDocs',
  'compareAnimation',
  'perf',
  'skyLayersGpu',
  'e2eWeb',
  'uniformVectors',
  'showcase',
];

describe('previewPort', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('gives each harness its own default port, so any two can run side by side', () => {
    for (const harness of HARNESSES) vi.stubEnv(previewPort(harness).portEnvName, '');
    const ports = HARNESSES.map((harness) => previewPort(harness).port);
    expect(new Set(ports).size).toBe(HARNESSES.length);
  });

  it('gives each harness its own override variable, so moving one moves no other', () => {
    const names = HARNESSES.map((harness) => previewPort(harness).portEnvName);
    expect(new Set(names).size).toBe(HARNESSES.length);
  });

  it("answers the harness's default port and the variable that moves it", () => {
    vi.stubEnv('VISUAL_PORT', '');
    expect(previewPort('visual')).toEqual({ port: 4317, portEnvName: 'VISUAL_PORT' });
  });

  it('answers the port the override variable names', () => {
    vi.stubEnv('PERF_PORT', '5001');
    expect(previewPort('perf')).toEqual({ port: 5001, portEnvName: 'PERF_PORT' });
  });

  it('keeps the default when the override is not a number (edge case)', () => {
    vi.stubEnv('PERF_PORT', 'soon');
    expect(previewPort('perf').port).toBe(4325);
  });

  it('names the harness it does not know (error case)', () => {
    expect(() => previewPort('visul')).toThrow(/expected one of .*visual.*, got "visul"/);
  });
});
