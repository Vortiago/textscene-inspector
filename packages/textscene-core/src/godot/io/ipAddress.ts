const IPV4_MAX_STRING_LENGTH = 16;
const IPV6_MAX_STRING_LENGTH = 40;
const COLON = 0x3a;
const DOT = 0x2e;

const isDecimalDigit = (code: number) => code >= 0x30 && code <= 0x39;

function hexValue(code: number): number | undefined {
  if (isDecimalDigit(code)) return code - 0x30;
  if (code >= 0x61 && code <= 0x66) return code - 0x61 + 10;
  if (code >= 0x41 && code <= 0x46) return code - 0x41 + 10;
  return undefined;
}

/** `_parse_ipv4` (ip_address.cpp:154): four decimal bytes from `start`, each 255 at most. */
function isIpv4(codes: readonly number[], start: number): boolean {
  let dots = 0;
  let next = 0;
  let isParsed = false;
  for (let i = start; i < codes.length; i++) {
    const code = codes[i]!;
    if (code === DOT) {
      if (!isParsed) return false;
      isParsed = false;
      next = 0;
      if (++dots > 3) return false;
    } else if (isDecimalDigit(code)) {
      isParsed = true;
      next = next * 10 + code - 0x30;
      if (next > 255) return false;
    } else return false;
  }
  return isParsed && dots === 3;
}

/** `_parse_ipv6` (ip_address.cpp:62) as far as validity: eight groups, one `::`, a mapped IPv4 tail. */
function isIpv6(codes: readonly number[]): boolean {
  const length = codes.length;
  const groups = new Uint16Array(9);
  let cur = 0;
  let shift = -1;
  for (let i = 0; i < length; i++) {
    for (let j = i; j < length; j++) {
      const code = codes[j]!;
      if (code === COLON) {
        if (j + 1 === length) return false;
        if (codes[j + 1] === COLON) {
          if (shift > -1) return false;
          shift = j === 0 ? cur : cur + 1;
          j++;
        } else if (i === j) return false;
        i = j;
        break;
      }
      if (j - i > 3) return false;
      const digit = hexValue(code);
      if (digit !== undefined) groups[cur] = (groups[cur]! << 4) | digit;
      else if (code === DOT) return isMappedIpv4(codes, groups, cur, shift, i);
      else return false;
      if (j + 1 === length) i = j;
    }
    cur += 1;
    if (cur > 8 || (cur === 8 && i + 1 !== length)) return false;
  }
  if (shift < 0) return cur === 8;
  return shift <= 7;
}

/** An IPv4 tail after `ffff`, with only zero groups before it (ip_address.cpp:99). */
function isMappedIpv4(
  codes: readonly number[],
  groups: Uint16Array,
  cur: number,
  shift: number,
  start: number
) {
  if (cur < 1 || groups[cur - 1] !== 0xffff) return false;
  if (shift < 0 && cur !== 6) return false;
  if (groups.subarray(0, cur - 1).some((group) => group !== 0)) return false;
  return isIpv4(codes, start);
}

/** `IPAddress::is_valid_ip_address` (ip_address.cpp:226). */
export function isValidIpAddress(codes: readonly number[]): boolean {
  if (codes.length < IPV6_MAX_STRING_LENGTH && codes.includes(COLON)) return isIpv6(codes);
  return codes.length < IPV4_MAX_STRING_LENGTH && isIpv4(codes, 0);
}
