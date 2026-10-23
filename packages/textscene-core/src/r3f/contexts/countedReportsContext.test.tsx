import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createCountedReportsContext } from './countedReportsContext';

const reports = createCountedReportsContext('TestReports');

function Reporter({ reportKey }: { reportKey: string | null }) {
  reports.useReportWhile(reportKey);
  return null;
}

function Reported() {
  return <span data-testid="reported">{[...reports.useReported()].sort().join(',')}</span>;
}

function renderReports(reporters: (string | null)[]) {
  const tree = (keys: (string | null)[]) => (
    <reports.Provider>
      {keys.map((key, index) => (
        <Reporter key={index} reportKey={key} />
      ))}
      <Reported />
    </reports.Provider>
  );
  const view = render(tree(reporters));
  return { rerenderWith: (keys: (string | null)[]) => view.rerender(tree(keys)) };
}

const reported = () => screen.getByTestId('reported').textContent;

describe('createCountedReportsContext', () => {
  it('lists a key while a reporter holds it', () => {
    renderReports(['a', 'b']);
    expect(reported()).toBe('a,b');
  });

  it('lists nothing for a reporter whose key is null', () => {
    renderReports([null]);
    expect(reported()).toBe('');
  });

  it('keeps a key while any reporter still holds it', () => {
    const { rerenderWith } = renderReports(['a', 'a']);
    rerenderWith(['a']);
    expect(reported()).toBe('a');
  });

  it('drops a key once its last reporter lets go', () => {
    const { rerenderWith } = renderReports(['a']);
    rerenderWith([]);
    expect(reported()).toBe('');
  });

  it('does nothing without a provider', () => {
    render(
      <>
        <Reporter reportKey="a" />
        <Reported />
      </>
    );
    expect(reported()).toBe('');
  });
});
