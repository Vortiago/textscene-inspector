import { describe, expect, it } from 'vitest';
import { SCENARIOS, scenariosOf } from './gateScenarios.mjs';

const namesOf = (scenarios) => scenarios.map(({ name }) => name);

describe('scenariosOf', () => {
  it('runs every scenario without a shard', () => {
    expect(scenariosOf(null)).toBe(SCENARIOS);
  });

  it('covers each scenario exactly once across the 2 CI shards', () => {
    const covered = [1, 2].flatMap((index) => namesOf(scenariosOf({ index, count: 2 })));
    expect(covered.sort()).toEqual(namesOf(SCENARIOS).sort());
  });

  it('keeps run order inside a shard', () => {
    const order = namesOf(SCENARIOS);
    for (const index of [1, 2]) {
      const names = namesOf(scenariosOf({ index, count: 2 }));
      expect(names).toEqual(order.filter((name) => names.includes(name)));
    }
  });

  it('gives each of 2 shards less than 60 % of the seconds', () => {
    const total = SCENARIOS.reduce((sum, { seconds }) => sum + seconds, 0);
    for (const index of [1, 2]) {
      const seconds = scenariosOf({ index, count: 2 }).reduce((sum, scenario) => sum + scenario.seconds, 0);
      expect(seconds / total).toBeLessThan(0.6);
    }
  });
});
