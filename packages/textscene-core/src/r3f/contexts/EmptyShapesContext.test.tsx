import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodePathProvider } from './NodePathContext';
import { EmptyShapeBranch, EmptyShapesProvider, useEmptyShape, useIsEmptyShape } from './EmptyShapesContext';

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
  const isEmpty = useEmptyShape(hasOwnEmptyBrush);
  return <EmptyShapeBranch isEmpty={isEmpty}>{children}</EmptyShapeBranch>;
}

function IsEmpty({ path }: { path: string }) {
  return <span data-testid={path}>{String(useIsEmptyShape(path))}</span>;
}

function renderShapes(shapes: ReactNode, paths: string[]) {
  return render(
    <EmptyShapesProvider>
      {shapes}
      {paths.map((path) => (
        <IsEmpty key={path} path={path} />
      ))}
    </EmptyShapesProvider>
  );
}

const isEmptyAt = (path: string) => screen.getByTestId(path).textContent;

describe('EmptyShapesContext', () => {
  it('lists a shape whose own brush is empty', () => {
    renderShapes(<Shape path="Root/Wall" hasOwnEmptyBrush />, ['Root/Wall']);
    expect(isEmptyAt('Root/Wall')).toBe('true');
  });

  it('lists nothing for a shape whose brush holds a solid', () => {
    renderShapes(<Shape path="Root/Wall" hasOwnEmptyBrush={false} />, ['Root/Wall']);
    expect(isEmptyAt('Root/Wall')).toBe('false');
  });

  it('lists a child of an empty shape, as Godot walks up the parent shapes', () => {
    renderShapes(
      <Shape path="Root" hasOwnEmptyBrush>
        <Shape path="Root/Wall" hasOwnEmptyBrush={false}>
          <Shape path="Root/Wall/Door" hasOwnEmptyBrush={false} />
        </Shape>
      </Shape>,
      ['Root/Wall', 'Root/Wall/Door']
    );
    expect(isEmptyAt('Root/Wall')).toBe('true');
    expect(isEmptyAt('Root/Wall/Door')).toBe('true');
  });

  it('lists nothing below an intervening node that is not a CSG shape', () => {
    renderShapes(
      <Shape path="Root" hasOwnEmptyBrush>
        <Shape path="Root/Pivot/Wall" hasOwnEmptyBrush={false} />
      </Shape>,
      ['Root/Pivot/Wall']
    );
    expect(isEmptyAt('Root/Pivot/Wall')).toBe('false');
  });

  it('drops a shape once its brush holds a solid again', () => {
    const tree = (hasOwnEmptyBrush: boolean) => (
      <EmptyShapesProvider>
        <Shape path="Root/Wall" hasOwnEmptyBrush={hasOwnEmptyBrush} />
        <IsEmpty path="Root/Wall" />
      </EmptyShapesProvider>
    );
    const { rerender } = render(tree(true));
    rerender(tree(false));
    expect(isEmptyAt('Root/Wall')).toBe('false');
  });
});
