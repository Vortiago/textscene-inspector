/** TextServer's locale answers, as the engine defines them. */

/**
 * The language subtags `TextServerAdvanced::_is_locale_right_to_left` treats as right-to-left
 * (`modules/text_server_adv/text_server_adv.cpp:536`). A fixed engine list, not an ICU query, so this codebase can hold it.
 * The fallback server answers `false` for every locale (`text_server_fb.cpp:190-192`): without the advanced module a
 * project is left-to-right throughout.
 */
export const RTL_LANGUAGE_CODES = ['ar', 'dv', 'he', 'fa', 'ff', 'ku', 'ur'] as const;

/**
 * `TS->is_locale_right_to_left(locale)` (`text_server_adv.cpp:534-541`): the language subtag alone decides it, so `he_IL`
 * answers like `he`. `set_locale` stores the form `TranslationServer::Locale` standardises
 * (`core/string/translation_server.cpp:171-175`): `-` becomes `_`, and anything after `@` is a variant, not the language.
 */
export function isLocaleRightToLeft(locale: string): boolean {
  const language = locale.replaceAll('-', '_').split('@')[0]!.split('_')[0]!;
  return (RTL_LANGUAGE_CODES as readonly string[]).includes(language);
}
