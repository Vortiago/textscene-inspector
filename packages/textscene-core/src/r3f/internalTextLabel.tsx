/**
 * Wrapper around drei's `<Text>` for in-scene labels.
 *
 * drei's `<Text>` is great in browsers but unusable in the test renderer:
 * it fetches font + unicode tables from a CDN at first render. Under
 * happy-dom the fetch fires but never resolves, leaking an unhandled
 * promise rejection that vitest counts as a test failure even when the
 * surrounding component renders correctly.
 *
 * This wrapper hides the `<Text>` behind a Suspense boundary and skips
 * it entirely under vitest (detected via `import.meta.vitest` /
 * `process.env.VITEST`). In production both web and VS Code load
 * drei's font resources from the CDN; the label appears as expected.
 */

import { Suspense, type ReactNode } from 'react';
import { Text } from '@react-three/drei/core/Text';

const IS_VITEST = (() => {
  const proc = (globalThis as { process?: { env?: { VITEST?: string } } })
    .process;
  return proc?.env?.VITEST === 'true';
})();

export interface InternalTextLabelProps {
  text: string;
  position?: [number, number, number];
  fontSize?: number;
  color?: string;
  outlineWidth?: number;
  outlineColor?: string;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom';
}

/**
 * In-scene text label. Renders `null` under vitest. In a browser the
 * label is wrapped in `<Suspense>` so a font-load failure doesn't take
 * down the parent group.
 */
export function InternalTextLabel({
  text,
  position,
  fontSize = 0.1,
  color = '#ffffff',
  outlineWidth = 0.006,
  outlineColor = '#000000',
  anchorX = 'center',
  anchorY = 'middle',
}: InternalTextLabelProps): ReactNode {
  if (IS_VITEST) return null;
  return (
    <Suspense fallback={null}>
      <Text
        position={position}
        fontSize={fontSize}
        color={color}
        outlineWidth={outlineWidth}
        outlineColor={outlineColor}
        anchorX={anchorX}
        anchorY={anchorY}
      >
        {text}
      </Text>
    </Suspense>
  );
}

