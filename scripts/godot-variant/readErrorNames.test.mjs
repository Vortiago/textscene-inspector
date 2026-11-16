import { describe, expect, it } from 'vitest';
import { errorNames } from './readErrorNames.mjs';

describe('errorNames', () => {
  it('reads each name of the table in order', () => {
    const source = `const char *error_names[] = {
	TTRC("OK"), // OK
	TTRC("Can't open file"), // ERR_FILE_CANT_OPEN
};`;
    expect(errorNames(source)).toEqual(['OK', "Can't open file"]);
  });

  it('refuses a source without the table', () => {
    expect(() => errorNames('int x;')).toThrow(/error_names/);
  });
});
