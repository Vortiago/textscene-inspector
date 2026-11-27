/**
 * Whether `get_token` skips `code` before a token: any code up to 32 (variant_parser.cpp:415-417).
 *
 * @canonical Whether Godot's tokenizer skips a code before a token
 */
export function isTokenGap(code: number): boolean {
  return code <= 32;
}
