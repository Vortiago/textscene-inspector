/** A painter's memo of {@link controlBidiOptions}, so a layout that depends on it re-shapes only when an input changes. */
import { useMemo } from 'react';
import { controlBidiOptions, type TextBidiOptions } from './textBidiOptions';
import type {
  StructuredTextOverrideProperties,
  TextDirectionProperties,
} from '../../../../godot/text/paragraphDirection';

export function useControlBidiOptions(
  props: TextDirectionProperties & Partial<StructuredTextOverrideProperties>,
  env: { rtl: boolean; locale: string }
): TextBidiOptions {
  return useMemo(
    () => controlBidiOptions(props, env),
    // `props` and `env` are the painter's whole node objects: these six fields are their identity for the bidi pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.textDirection,
      props.language,
      props.structuredTextBidiOverride,
      props.structuredTextBidiOverrideOptions,
      env.rtl,
      env.locale,
    ]
  );
}
