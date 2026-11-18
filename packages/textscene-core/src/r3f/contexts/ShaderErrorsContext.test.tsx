import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodePathProvider } from './NodePathContext';
import { ShaderErrorsProvider, useShaderErrorReport, useShaderErrors } from './ShaderErrorsContext';

const ERROR = 'res://sky.gdshader:3:14: Invalid assignment of a float to a vec3.';

function Reporter({ path, message }: { path: string; message: string | null }) {
  return (
    <NodePathProvider path={path}>
      <Report message={message} />
    </NodePathProvider>
  );
}

function Report({ message }: { message: string | null }) {
  useShaderErrorReport(message);
  return null;
}

function Errors({ path }: { path: string }) {
  return <span data-testid="errors">{useShaderErrors(path).join('|')}</span>;
}

function renderErrors(children: ReactNode) {
  return render(
    <ShaderErrorsProvider>
      {children}
      <Errors path="World/Environment" />
    </ShaderErrorsProvider>
  );
}

describe('ShaderErrorsContext', () => {
  it('lists the error a node reports', () => {
    renderErrors(<Reporter path="World/Environment" message={ERROR} />);
    expect(screen.getByTestId('errors').textContent).toBe(ERROR);
  });

  it("keeps another node's errors apart", () => {
    renderErrors(<Reporter path="World/Camera" message={ERROR} />);
    expect(screen.getByTestId('errors').textContent).toBe('');
  });

  it('reports nothing for a null message', () => {
    renderErrors(<Reporter path="World/Environment" message={null} />);
    expect(screen.getByTestId('errors').textContent).toBe('');
  });

  it('drops an error once its reporter unmounts', () => {
    const tree = (isHeld: boolean) => (
      <ShaderErrorsProvider>
        {isHeld && <Reporter path="World/Environment" message={ERROR} />}
        <Errors path="World/Environment" />
      </ShaderErrorsProvider>
    );
    const { rerender } = render(tree(true));
    rerender(tree(false));
    expect(screen.getByTestId('errors').textContent).toBe('');
  });
});
