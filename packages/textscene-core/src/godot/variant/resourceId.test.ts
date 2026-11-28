import { expect, it } from 'vitest';
import { loadedResourceId } from './resourceId.js';
import { resolvedResourceRef, resourceRef } from './resourceRef.js';

it.each([
  ['01', '1'],
  ['"01"', '01'],
  ['""', ''],
  ['-12', '-12'],
  ['3.0', '3.0'],
  ['1e1', '10.0'],
  ['9223372036854775808', '-9223372036854775808'],
  ['18446744073709551616', '9223372036854775807'],
  [String.raw`"\u0061"`, 'a'],
  [String.raw`"\u00c3\u00a9"`, 'é'],
  [String.raw`"\u00e9"`, '�'],
  [String.raw`"\uD83D\uDE00"`, ' '],
  ['"😂"', '😂'],
  [String.raw`"a\tb"`, 'a\tb'],
])('resolves the loader ID %s to %s', (token, id) => {
  expect(loadedResourceId(token)).toBe(id);
  expect(resolvedResourceRef(`SubResource (${token})`)).toEqual({ kind: 'SubResource', id });
});

it.each(['-.5', '-', '-e2', '.5', '-inf', '+1', 'e2', String.raw`"\uDA22"`, String.raw`"\u12q4"`])(
  'rejects the invalid ID token %s',
  (token) => {
    expect(loadedResourceId(token)).toBeNull();
  }
);

it('retains the spelling for callers that read source text', () => {
  expect(resourceRef('SubResource(01)')?.id).toBe('01');
});
