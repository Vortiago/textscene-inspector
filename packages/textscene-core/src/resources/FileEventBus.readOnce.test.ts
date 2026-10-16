/**
 * `readOnce` is the optional-file read for a caller that keeps what it needs from the file, so
 * the bus drops its copy, unless a processor is also loading the file and needs the bytes.
 */
import { describe, expect, it } from 'vitest';
import { FileEventBus } from './FileEventBus';
import { busServing } from './testing/servingFileBus';

describe('FileEventBus.readOnce', () => {
  it('returns the file and keeps no copy of it', async () => {
    const { bus } = busServing({ 'res://normal.png': 'bytes' });

    await expect(bus.readOnce('res://normal.png')).resolves.toBe('bytes');
    expect(bus.isCached('res://normal.png')).toBe(false);
  });

  it('returns null for a missing file', async () => {
    const { bus } = busServing({});
    await expect(bus.readOnce('res://absent.png')).resolves.toBeNull();
  });

  it('keeps the copy while a processor is also loading the file', async () => {
    const loads: Array<() => Promise<string>> = [() => new Promise<string>(() => {}), async () => 'bytes'];
    const bus = new FileEventBus({ loadResource: () => loads.shift()!() });
    bus.request('res://normal.png');

    await bus.readOnce('res://normal.png');
    expect(bus.isCached('res://normal.png')).toBe(true);
  });
});
