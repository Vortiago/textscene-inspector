/**
 * Shared BoxContainer base — the single owner of the `alignment` grammar and
 * its CSS mapping for the HBox/VBox slice family. The slices' own tests pin
 * the wired behavior; this pins the base directly (the lights/shared
 * precedent) so a base regression reports here, not as a slice failure.
 */
import { describe, expect, it } from 'vitest';
import { alignmentJustify, parseBoxContainer } from './boxContainer';

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

describe('alignmentJustify', () => {
  it('maps BEGIN/CENTER/END to flex packing', () => {
    expect(alignmentJustify(0)).toBe('flex-start');
    expect(alignmentJustify(1)).toBe('center');
    expect(alignmentJustify(2)).toBe('flex-end');
  });

  it('treats absent and out-of-range as BEGIN (the Godot default)', () => {
    expect(alignmentJustify(undefined)).toBe('flex-start');
    expect(alignmentJustify(7)).toBe('flex-start');
    expect(alignmentJustify(-1)).toBe('flex-start');
  });
});
