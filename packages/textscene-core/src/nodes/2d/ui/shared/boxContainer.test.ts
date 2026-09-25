/**
 * Shared BoxContainer base, the one owner of the `alignment` grammar. Pinned here directly so a base
 * regression reports here, not as a slice failure.
 */
import { describe, expect, it } from 'vitest';
import { parseBoxContainer } from './boxContainer';

const heading = { type: 'node', attributes: { type: 'HBoxContainer', name: 'Row' } };

describe('parseBoxContainer', () => {
  it('parses alignment 0/1/2 as integers on top of the Control base', () => {
    expect(parseBoxContainer(heading, { alignment: '0' }).alignment).toBe(0);
    expect(parseBoxContainer(heading, { alignment: '1' }).alignment).toBe(1);
    expect(parseBoxContainer(heading, { alignment: '2' }).alignment).toBe(2);
  });

  it('leaves alignment undefined when absent or malformed', () => {
    expect(parseBoxContainer(heading, {}).alignment).toBeUndefined();
    expect(parseBoxContainer(heading, { alignment: 'garbage' }).alignment).toBeUndefined();
  });
});

