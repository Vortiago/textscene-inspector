import { describe, expect, it } from 'vitest';
import { inChunksAtOnce, inChunksOfAtMost, projectGodot } from './godotRun.mjs';

describe('inChunksAtOnce', () => {
  it.each(Array.from({ length: 40 }, (_, length) => length + 1))(
    'runs no empty chunk for %i items',
    async (length) => {
      const items = Array.from({ length }, (_, index) => index);
      const chunks = await inChunksAtOnce(items, async (chunk) => chunk);
      expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
      expect(chunks.flat()).toEqual(items);
    }
  );

  it('runs one empty chunk for no items, so the caller still reads Godot', async () => {
    expect(await inChunksAtOnce([], async (chunk) => chunk)).toEqual([[]]);
  });
});

describe('inChunksOfAtMost', () => {
  it('runs no chunk of more than the given size, in order', async () => {
    const items = Array.from({ length: 1000 }, (_, index) => index);
    const chunks = await inChunksOfAtMost(items, 64, async (chunk) => chunk);
    expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(64);
    expect(chunks.flat()).toEqual(items);
  });

  it('runs one empty chunk for no items, so the caller still reads Godot', async () => {
    expect(await inChunksOfAtMost([], 64, async (chunk) => chunk)).toEqual([[]]);
  });
});

describe('projectGodot', () => {
  it('ends with the settings a run gives, as sections Godot reads after its own', () => {
    const text = projectGodot('[rendering]\nlimits/time/time_rollover_secs=1.2\n');
    expect(text.endsWith('\n[rendering]\nlimits/time/time_rollover_secs=1.2\n')).toBe(true);
    expect(text).toContain('run/main_scene="res://main.tscn"');
  });

  it('is the plain project for no settings', () => {
    expect(projectGodot()).not.toContain('[rendering]');
  });
});
