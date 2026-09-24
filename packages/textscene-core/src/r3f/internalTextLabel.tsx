/**
 * drei's `<Text>` for in-scene labels, skipped under vitest: its CDN font fetch never resolves
 * under happy-dom, and the leaked rejection fails the test. `React.lazy` loads it, since esbuild
 * splits only a dynamic `import()` out of `TscnCanvas.tsx`'s chunk (~312KB raw with its deps).
 */

import { lazy, Suspense, type ReactNode } from 'react';

const Text = lazy(() =>
  import('@react-three/drei/core/Text').then((m) => ({ default: m.Text }))
);

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
 * Renders `null` under vitest. In a browser `<Suspense>` wraps the label, so a font-load failure
 * does not take down the parent group.
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

