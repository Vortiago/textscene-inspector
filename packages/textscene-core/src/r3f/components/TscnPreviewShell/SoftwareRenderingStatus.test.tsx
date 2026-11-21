import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SoftwareRenderingStatus } from './SoftwareRenderingStatus';

const STATUS_TESTID = 'software-rendering-status';

describe('SoftwareRenderingStatus', () => {
  it('shows a polite status, with what to do in its title, while the view draws in software', () => {
    render(<SoftwareRenderingStatus isSoftwareRendering />);
    const status = screen.getByTestId(STATUS_TESTID);
    expect(status.textContent).toBe('Software WebGL');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('title')).toMatch(/graphics acceleration/);
  });

  it('is absent while a GPU draws', () => {
    render(<SoftwareRenderingStatus isSoftwareRendering={false} />);
    expect(screen.queryByTestId(STATUS_TESTID)).toBeNull();
  });
});
