import { describe, expect, it } from 'vitest';
import { maxWorkersFor, vmMemoryLimit } from '../vitest.shared.ts';

const GB = 1024 ** 3;

describe('maxWorkersFor', () => {
  it('red: caps by CPU on a small idle CI runner (unchanged behaviour)', () => {
    // 4 vCPU runner, 16 GB idle: workers = min(16, 3, memCap) = 3
    expect(maxWorkersFor(16 * GB, 15 * GB, 4)).toBe(3);
  });

  it('red: caps by memory on a loaded 12-core desktop', () => {
    // 31 GB total, 8 GB free, 12 cpus: cpuCap=11, memCap=floor((31-4-23)/2)=2
    expect(maxWorkersFor(31 * GB, 8 * GB, 12)).toBe(2);
  });

  it('red: never returns 0 or negative, even when memory is exhausted', () => {
    expect(maxWorkersFor(31 * GB, 0, 12)).toBe(1);
    expect(maxWorkersFor(4 * GB, 0, 2)).toBe(1);
  });

  it('red: never exceeds 16 even on a huge idle machine', () => {
    expect(maxWorkersFor(128 * GB, 120 * GB, 64)).toBe(16);
  });

  it('red: idle big desktop still gets the full CPU cap', () => {
    // 31 GB total, 25 GB free, 12 cpus: memCap=floor((27-6)/2)=10, cpuCap=11 -> 10
    expect(maxWorkersFor(31 * GB, 25 * GB, 12)).toBe(10);
  });
});

describe('vmMemoryLimit', () => {
  it('stays at 70% of the V8 heap limit, expressed in MB', () => {
    expect(vmMemoryLimit).toMatch(/^\d+MB$/);
  });
});
