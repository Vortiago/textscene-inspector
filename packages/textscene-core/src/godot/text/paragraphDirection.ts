/**
 * The properties a text node hands the text server for its paragraph's bidi pass: the direction
 * and the language, and on the types that have one, the structured-text override.
 */

/** `text_direction` and `language`, which every text Control, Label3D and TextMesh has. */
export interface TextDirectionProperties {
  /** `Control::TextDirection`. Godot default TEXT_DIRECTION_AUTO on every type that has it. */
  textDirection: number;
  /** The casing and the direction of a text with no strong character. Empty takes the locale. */
  language: string;
}

/** `structured_text_bidi_override` and its options, which only some text types have. */
export interface StructuredTextOverrideProperties {
  /** `TextServer::StructuredTextParser`. Godot default STRUCTURED_TEXT_DEFAULT on every type that has it. */
  structuredTextBidiOverride: number;
  /** `structured_text_bidi_override_options`, an untyped `Array`: each String or StringName element, null for any other Variant. */
  structuredTextBidiOverrideOptions: (string | null)[];
}
