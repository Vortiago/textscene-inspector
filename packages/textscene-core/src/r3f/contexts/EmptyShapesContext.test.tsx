import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodePathProvider } from './NodePathContext';
import { EmptyShapeBranch, useReportEmptyShape } from './EmptyShapesContext';
import { ViewStatusProvider } from '../viewStatus/ViewStatusContext';
import { createViewStatusStore, type ViewStatusStore } from '../viewStatus/viewStatus';

/** A CSG shape at `path` that holds `children`, with a brush that is `hasOwnEmptyBrush`. */
function Shape({
  path,
  hasOwnEmptyBrush,
  children,
}: {
  path: string;
  hasOwnEmptyBrush: boolean;
  children?: ReactNode;
}) {
  return (
    <NodePathProvider path={path}>
      <ShapeBody hasOwnEmptyBrush={hasOwnEmptyBrush}>{children}</ShapeBody>
    </NodePathProvider>
  );
}

function ShapeBody({ hasOwnEmptyBrush, children }: { hasOwnEmptyBrush: boolean; children?: ReactNode }) {
  const isEmpty = useReportEmptyShape(hasOwnEmptyBrush);
  return <EmptyShapeBranch isEmpty={isEmpty}>{children}</EmptyShapeBranch>;
}

let store: ViewStatusStore;

beforeEach(() => {
  store = createViewStatusStore();
});

function inView(shapes: ReactNode) {
  return <ViewStatusProvider store={store}>{shapes}</ViewStatusProvider>;
}

function renderShapes(shapes: ReactNode) {
  return render(inView(shapes));
}

const isEmptyAt = (path: string) =>
  String(store.status().undrawn.some((node) => node.path === `/root/${path}` && node.isEmptyShape));

describe('EmptyShapesContext', () => {
  it('lists a shape whose own brush is empty', () => {
    renderShapes(<Shape path="Root/Wall" hasOwnEmptyBrush />);
    expect(isEmptyAt('Root/Wall')).toBe('true');
  });

  it('lists nothing for a shape whose brush holds a solid', () => {
    renderShapes(<Shape path="Root/Wall" hasOwnEmptyBrush={false} />);
    expect(isEmptyAt('Root/Wall')).toBe('false');
  });

  it('lists a child of an empty shape, as Godot walks up the parent shapes', () => {
    renderShapes(
      <Shape path="Root" hasOwnEmptyBrush>
        <Shape path="Root/Wall" hasOwnEmptyBrush={false}>
          <Shape path="Root/Wall/Door" hasOwnEmptyBrush={false} />
        </Shape>
      </Shape>
    );
    expect(isEmptyAt('Root/Wall')).toBe('true');
    expect(isEmptyAt('Root/Wall/Door')).toBe('true');
  });

  it('lists nothing below an intervening node that is not a CSG shape', () => {
    renderShapes(
      <Shape path="Root" hasOwnEmptyBrush>
        <Shape path="Root/Pivot/Wall" hasOwnEmptyBrush={false} />
      </Shape>
    );
    expect(isEmptyAt('Root/Pivot/Wall')).toBe('false');
  });

  it('drops a shape once its brush holds a solid again', () => {
    const tree = (hasOwnEmptyBrush: boolean) =>
      inView(<Shape path="Root/Wall" hasOwnEmptyBrush={hasOwnEmptyBrush} />);
    const { rerender } = render(tree(true));
    rerender(tree(false));
    expect(isEmptyAt('Root/Wall')).toBe('false');
  });
});
