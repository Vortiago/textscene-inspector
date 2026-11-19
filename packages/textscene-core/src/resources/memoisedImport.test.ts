/** A memoised import loads once for every caller. */
import { describe, expect, it } from 'vitest';
import { memoisedImport, moduleWork } from './memoisedImport';

describe('memoisedImport', () => {
  it('imports once for every call', () => {
    let imports = 0;
    const load = memoisedImport(() => {
      imports++;
      return Promise.resolve('module');
    });
    void load();
    void load();
    expect(imports).toBe(1);
  });

  it('counts its import as work until the module lands, so a scene settles after it', async () => {
    const before = moduleWork.pending();
    const load = memoisedImport(() => Promise.resolve('module'));
    const loading = load();
    expect(moduleWork.pending()).toBe(before + 1);
    await loading;
    expect(moduleWork.pending()).toBe(before);
  });

  it('ends its work when the import fails (edge case)', async () => {
    const before = moduleWork.pending();
    const load = memoisedImport(() => Promise.reject(new Error('offline')));
    await expect(load()).rejects.toThrow('offline');
    expect(moduleWork.pending()).toBe(before);
  });
});
