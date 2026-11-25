import { describe, expect, it } from 'vitest';
import { createLateReader } from './lateReader';

describe('createLateReader', () => {
  it('answers an ask made before the fill once the fill lands', async () => {
    const reader = createLateReader<string, number>();
    const answer = reader.read('a');
    reader.fill((key) => key.length);
    await expect(answer).resolves.toBe(1);
  });

  it('answers with the latest fill', async () => {
    const reader = createLateReader<string, number>();
    reader.fill(() => 1);
    reader.fill(() => 2);
    await expect(reader.read('a')).resolves.toBe(2);
  });

  it('rejects with the error the fill throws', async () => {
    const reader = createLateReader<string, number>();
    reader.fill(() => {
      throw new Error('expected a camera, got none');
    });
    await expect(reader.read('a')).rejects.toThrow('expected a camera, got none');
  });
});
