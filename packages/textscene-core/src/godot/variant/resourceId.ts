import { STRING_LITERAL_SOURCE } from '../string/string.js';
import { FLOAT_PATTERN_SOURCE } from './number.js';
import { readVariant } from './strToVar.js';
import { stringify } from './variantStringify.js';

const STRING_TOKEN = new RegExp(`^${STRING_LITERAL_SOURCE}$`);
const NUMBER_TOKEN = new RegExp(`^${FLOAT_PATTERN_SOURCE}$`);

// resource_format_text.cpp:488, :566
export function headingResourceId(token: string): string | null {
  if (STRING_TOKEN.test(token) && !token.includes('\\')) return token.slice(1, -1);
  const read = readVariant(token, { fileStream: true });
  return 'value' in read ? stringify(read.value) : null;
}

/** @canonical read a resource loader ID from its quoted string or numeric Variant token */
export function loadedResourceId(token: string): string | null {
  if (!STRING_TOKEN.test(token) && !NUMBER_TOKEN.test(token)) return null;
  return headingResourceId(token);
}
