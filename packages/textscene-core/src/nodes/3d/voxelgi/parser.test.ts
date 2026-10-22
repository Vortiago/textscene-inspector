import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseVoxelGI } from './parser';

const parse = (properties: Record<string, string>) =>
  parseVoxelGI(heading('VoxelGI', { name: 'Probe' }), properties);

describe('parseVoxelGI', () => {
  it('reads an empty VoxelGI as Godot constructs it: 20 on each side, 128 subdivisions', () => {
    const { size, subdiv } = parse({});
    expect([size, subdiv]).toEqual([{ x: 20, y: 20, z: 20 }, 1]);
  });

  it('reads size and subdiv', () => {
    const { size, subdiv } = parse({ size: 'Vector3(40, 10, 10)', subdiv: '0' });
    expect([size, subdiv]).toEqual([{ x: 40, y: 10, z: 10 }, 0]);
  });

  it('raises a side below 1 to 1, as set_size does (edge case)', () => {
    expect(parse({ size: 'Vector3(0.25, -4, 2)' }).size).toEqual({ x: 1, y: 1, z: 2 });
  });

  it('keeps the default subdiv for one outside the enum, which set_subdiv refuses (error case)', () => {
    expect(parse({ subdiv: '4' }).subdiv).toBe(1);
  });

  it('keeps the defaults for malformed values (error case)', () => {
    const { size, subdiv } = parse({ size: 'Vector3(bad)', subdiv: 'many' });
    expect([size, subdiv]).toEqual([{ x: 20, y: 20, z: 20 }, 1]);
  });
});
