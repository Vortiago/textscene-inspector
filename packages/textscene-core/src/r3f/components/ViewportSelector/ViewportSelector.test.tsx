import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewportSelector } from './ViewportSelector';

describe('<ViewportSelector>', () => {
  const options = [
    { value: 'a.tscn', label: 'A Scene', category: 'Examples' },
    { value: 'b.tscn', label: 'B Scene', category: 'Examples' },
    { value: 'unit.tscn', label: 'Unit Plane', category: 'Unit' },
  ];

  it('renders all options', () => {
    render(<ViewportSelector options={options} value="a.tscn" onChange={() => {}} />);
    expect(screen.getByRole('option', { name: 'A Scene' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'B Scene' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Unit Plane' })).toBeTruthy();
  });

  it('respects the current value', () => {
    render(<ViewportSelector options={options} value="b.tscn" onChange={() => {}} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('b.tscn');
  });

  it('groups options by category', () => {
    render(<ViewportSelector options={options} value="a.tscn" onChange={() => {}} />);
    // optgroup has accessible name from the label attribute.
    const select = screen.getByRole('combobox');
    const optgroups = select.querySelectorAll('optgroup');
    expect(optgroups).toHaveLength(2);
    expect(optgroups[0]!.getAttribute('label')).toBe('Examples');
    expect(optgroups[1]!.getAttribute('label')).toBe('Unit');
  });

  it('fires onChange with the new value when selection changes', async () => {
    const onChange = vi.fn();
    render(<ViewportSelector options={options} value="a.tscn" onChange={onChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'unit.tscn');
    expect(onChange).toHaveBeenCalledWith('unit.tscn');
  });

  it('uses a custom label when provided', () => {
    render(
      <ViewportSelector options={options} value="a.tscn" onChange={() => {}} label="Fixture:" />
    );
    expect(screen.getByText('Fixture:')).toBeTruthy();
  });
});
