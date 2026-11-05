/** A painter's memo of {@link controlBidiOptions}, so a layout that depends on it re-shapes only when an input changes. */
import { useMemo } from 'react';
import {
  controlBidiOptions,
  type BidiProperties,
  type ControlTextEnv,
  type TextBidiOptions,
} from './textBidiOptions';

export function useControlBidiOptions(props: BidiProperties, env: ControlTextEnv): TextBidiOptions {
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
