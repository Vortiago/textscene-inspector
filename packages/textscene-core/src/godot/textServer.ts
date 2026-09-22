/** TextServer's locale answers, as the engine defines them. */

/**
 * The language subtags `TextServerAdvanced::_is_locale_right_to_left` treats as
 * right-to-left (`modules/text_server_adv/text_server_adv.cpp:536`).
 *
 * A fixed list in the engine, not an ICU query — which is why this is a fact
 * this codebase can hold rather than a dependency it cannot. The FALLBACK
 * server answers `false` for every locale (`text_server_fb.cpp:190-192`), so a
 * project running without the advanced module is left-to-right throughout.
 */
export const RTL_LANGUAGE_CODES = ['ar', 'dv', 'he', 'fa', 'ff', 'ku', 'ur'] as const;

/**
 * `TS->is_locale_right_to_left(locale)` (`text_server_adv.cpp:534-541`): the
 * language subtag alone decides it, so `he_IL` answers like `he`.
 *
 * The standardisation ahead of the slice is `TranslationServer::Locale`'s
 * (`core/string/translation_server.cpp:171-175`) — `-` becomes `_` and
 * anything after `@` is a variant, not part of the language. `set_locale`
 * stores that standardised form, so the table is only ever handed one.
 */
export function isLocaleRightToLeft(locale: string): boolean {
  const language = locale.replaceAll('-', '_').split('@')[0]!.split('_')[0]!;
  return (RTL_LANGUAGE_CODES as readonly string[]).includes(language);
}
