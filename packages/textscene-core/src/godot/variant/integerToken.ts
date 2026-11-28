const INT64_MAX = (1n << 63n) - 1n;
const INT64_MIN = -(1n << 63n);
const INT64_MAX_TENTH = INT64_MAX / 10n;

/** @canonical read a validated integer token at Godot's Variant width (ustring.cpp:2647-2677) */
export function integerToken(token: string): bigint {
  const negative = token.startsWith('-');
  let integer = 0n;
  for (let i = negative ? 1 : 0; i < token.length; i++) {
    if (integer > INT64_MAX_TENTH) return negative ? INT64_MIN : INT64_MAX;
    integer = BigInt.asIntN(64, integer * 10n + BigInt(token.charCodeAt(i) - 48));
  }
  return BigInt.asIntN(64, negative ? -integer : integer);
}
