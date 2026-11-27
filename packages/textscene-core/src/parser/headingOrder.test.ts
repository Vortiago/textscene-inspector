import { describe, expect, it } from 'vitest';
import { headingOrder, missingField } from './headingOrder.js';

function misplacedIn(...types: string[]) {
  const order = headingOrder();
  types.forEach((type, index) => order.read(type, index + 1));
  return order.stop();
}

describe('headingOrder', () => {
  it('answers the type of the last heading read', () => {
    const order = headingOrder();
    const previous = ['gd_scene', 'node'].map((type, index) => {
      const before = order.previous();
      order.read(type, index + 1);
      return before;
    });

    expect([...previous, order.previous()]).toEqual([null, 'gd_scene', 'node']);
  });

  it.each([
    [['gd_scene', 'ext_resource', 'sub_resource', 'node', 'node', 'connection', 'editable']],
    [['gd_resource', 'ext_resource', 'sub_resource', 'resource']],
  ])('takes each heading in its place: %j', (types) => {
    expect(misplacedIn(...types)).toBeNull();
  });

  it.each([
    [['gd_scene', 'sub_resource', 'ext_resource', 'node'], 'ext_resource', 3, 'unknown tag'],
    [['gd_scene', 'node', 'ext_resource'], 'ext_resource', 3, 'unknown tag'],
    [['gd_scene', 'node', 'connection', 'sub_resource'], 'sub_resource', 4, 'unknown tag'],
    [['gd_scene', 'connection', 'node'], 'connection', 2, 'unknown tag'],
    [['gd_scene', 'resource', 'node'], 'resource', 2, 'resource in scene'],
    [['gd_resource', 'node'], 'node', 2, 'node in resource'],
    [['gd_resource', 'resource', 'sub_resource'], 'sub_resource', 3, 'extra tag'],
  ])('refuses the first misplaced heading of %j', (types, type, line, reason) => {
    expect(misplacedIn(...types)).toEqual({ type, line, reason });
  });

  it('keeps the first refusal, as the loader stops there', () => {
    expect(misplacedIn('gd_scene', 'node', 'sub_resource', 'ext_resource')).toMatchObject({ line: 3 });
  });

  it.each([
    ['ext_resource', ['id'], 'path'],
    ['ext_resource', ['path', 'id'], 'type'],
    ['sub_resource', ['type'], 'id'],
    ['connection', ['from', 'to', 'signal'], 'method'],
    ['node', [], undefined],
    ['ext_resource', ['path', 'type', 'id'], undefined],
  ])('names the first required field a [%s] with %j lacks', (type, keys, field) => {
    expect(missingField(type, keys)).toBe(field);
  });

  it('stops at a heading in its place that lacks a required field', () => {
    const order = headingOrder();
    order.read('gd_scene', 1);
    order.read('ext_resource', 3, 'id');
    order.read('node', 5);

    expect(order.stop()).toEqual({ type: 'ext_resource', line: 3, missing: 'id' });
  });

  it('judges the place before the fields', () => {
    const order = headingOrder();
    ['gd_scene', 'node'].forEach((type, index) => order.read(type, index + 1));
    order.read('ext_resource', 3, 'id');

    expect(order.stop()).toEqual({ type: 'ext_resource', line: 3, reason: 'unknown tag' });
  });

  it('stops at a header that lacks a required field', () => {
    const order = headingOrder();
    order.read('gd_resource', 2, 'type');

    expect(order.stop()).toEqual({ type: 'gd_resource', line: 2, missing: 'type' });
  });

  const unparsed = { error: 'Expected identifier', code: 'ERR_PARSE_ERROR', line: 3 } as const;

  it('stops at a heading that does not parse, and judges no heading after it', () => {
    const order = headingOrder();
    order.read('gd_scene', 1);
    order.refuse(unparsed);
    order.read('ext_resource', 5);

    expect([order.stop(), order.isStopped()]).toEqual([{ ...unparsed, readBy: 'opening tag' }, true]);
  });

  it.each([
    [[], 'header'],
    [['gd_scene', 'node'], 'node body'],
    [['gd_scene', 'ext_resource'], 'section'],
    [['gd_resource', 'resource'], 'section'],
  ])('names the call that reads a heading after %j: %s', (types, readBy) => {
    const order = headingOrder();
    types.forEach((type, index) => order.read(type, index + 1));
    order.refuse(unparsed);

    expect(order.stop()).toMatchObject({ readBy });
  });

  it('keeps a misplaced heading before one that does not parse', () => {
    const order = headingOrder();
    ['gd_scene', 'node', 'sub_resource'].forEach((type, index) => order.read(type, index + 1));
    order.refuse(unparsed);

    expect(order.stop()).toMatchObject({ type: 'sub_resource' });
  });

  it('records no stop of a file whose first heading is no header', () => {
    const order = headingOrder();
    order.read('node', 1);
    order.refuse(unparsed);

    expect([order.stop(), order.isStopped()]).toEqual([null, true]);
  });

  it('judges no heading of a file with no header line', () => {
    expect(misplacedIn('node', 'sub_resource')).toBeNull();
  });
});
