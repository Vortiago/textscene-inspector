/**
 * Renders a reader hook with a load that settles in the gap a reader cannot see: after the reader
 * rendered and before its effects subscribe.
 */
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';

/**
 * Every value `read` returned, one per render of the reader, the first before `settle` ran. `settle`
 * runs in a sibling that renders after the reader and before the commit.
 */
export function renderWithSettleInGap<T>(
  read: () => T,
  settle: () => void,
  wrapper?: (props: { children: ReactNode }) => ReactNode
): T[] {
  const reads: T[] = [];
  function Reader() {
    reads.push(read());
    return null;
  }
  function Sibling() {
    settle();
    return null;
  }
  render(
    <>
      <Reader />
      <Sibling />
    </>,
    { wrapper }
  );
  return reads;
}
