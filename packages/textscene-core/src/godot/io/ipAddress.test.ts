import { describe, expect, it } from 'vitest';
import { codesOf } from '../string/ustring/codes';
import { isValidIpAddress } from './ipAddress';

const isValid = (text: string) => isValidIpAddress(codesOf(text));

describe('isValidIpAddress', () => {
  it.each(['127.0.0.1', '::', 'fe80::1', '1:2:3:4:5:6:7:8', '::ffff:1.2.3.4', '0:0:0:0:0:ffff:1.2.3.4'])(
    'accepts %s',
    (text) => expect(isValid(text)).toBe(true)
  );

  it.each(['256.1.1.1', '1.2.3', '1::2::3', '12345::', '1:2:3:4:5:6:7:8:9', '1:0:0:0:0:ffff:1.2.3.4', '1:'])(
    'refuses %s',
    (text) => expect(isValid(text)).toBe(false)
  );
});
