import { describe, expect, it, vi } from 'vitest';
import { CountedReports } from './countedReports';

describe('CountedReports', () => {
  it('reports a key from its first report', () => {
    const reports = new CountedReports();
    reports.report('a');
    expect([...reports.keys()]).toEqual(['a']);
  });

  it('keeps a key while another report of it is open', () => {
    const reports = new CountedReports();
    reports.report('a');
    reports.report('a');
    reports.clear('a');
    expect(reports.keys().has('a')).toBe(true);
  });

  it('drops a key when its last report is withdrawn', () => {
    const reports = new CountedReports();
    reports.report('a');
    reports.report('a');
    reports.clear('a');
    reports.clear('a');
    expect(reports.keys().size).toBe(0);
  });

  it('drops a key and every open report of it at once with clearAll', () => {
    const reports = new CountedReports();
    reports.report('a');
    reports.report('a');
    reports.clearAll('a');
    reports.report('a');
    reports.clear('a');
    expect(reports.keys().size).toBe(0);
  });

  it('ignores a clear with no open report', () => {
    const reports = new CountedReports();
    reports.clear('a');
    reports.report('a');
    expect(reports.keys().has('a')).toBe(true);
  });

  it('reports nothing for an empty key', () => {
    const reports = new CountedReports();
    reports.report('');
    expect(reports.keys().size).toBe(0);
  });

  it('tells a subscriber when the set changes, and not for a second report of a key', () => {
    const reports = new CountedReports();
    const listener = vi.fn();
    reports.subscribe(listener);
    reports.report('a');
    reports.report('a');
    reports.clear('a');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
