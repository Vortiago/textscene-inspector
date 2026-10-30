/** A memoised import loads once for every caller. */
import { describe, expect, it } from 'vitest';
import { memoisedImport } from './memoisedImport';

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
});
