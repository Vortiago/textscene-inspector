import { describe, expect, it } from 'vitest';
import { DependencyGraph, type Dependent } from './dependencyGraph';

const theme = (key: string): Dependent => ({ busType: 'theme', key });
const font = (key: string): Dependent => ({ busType: 'font', key });

describe('DependencyGraph.release', () => {
  it('returns the dependent that read the changed file', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://ui.tres'), 'res://body.ttf');

    expect(graph.release('res://body.ttf')).toEqual([theme('res://ui.tres')]);
  });

  it('matches an edge recorded against an address by the address’s file', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://ui.tres'), 'res://fonts.tres::FontVariation_a');

    expect(graph.release('res://fonts.tres')).toEqual([theme('res://ui.tres')]);
  });

  it('follows a chain through each dependent’s own key', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://ui.tres'), 'res://bold.tres');
    graph.record(font('res://bold.tres'), 'res://base.ttf');

    expect(graph.release('res://base.ttf')).toEqual([font('res://bold.tres'), theme('res://ui.tres')]);
  });

  it('follows a chain only to the readers of the address that changed, not of its whole file', () => {
    const graph = new DependencyGraph();
    graph.record(font('res://fonts.tres::b'), 'res://base.ttf');
    graph.record(theme('res://ui.tres'), 'res://fonts.tres::a');

    expect(graph.release('res://base.ttf')).toEqual([font('res://fonts.tres::b')]);
  });

  it('reaches a Theme through the edge to its own file that an inline font makes', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://ui.tres'), 'res://ui.tres::FontVariation_x');
    graph.record(font('res://ui.tres::FontVariation_x'), 'res://base.ttf');

    expect(graph.release('res://base.ttf')).toEqual([
      font('res://ui.tres::FontVariation_x'),
      theme('res://ui.tres'),
    ]);
  });

  it('stops on a cycle, and leaves out a dependent inside the changed file, which its clear covers', () => {
    const graph = new DependencyGraph();
    graph.record(font('res://a.tres'), 'res://b.tres');
    graph.record(font('res://b.tres'), 'res://a.tres');

    expect(graph.release('res://a.tres')).toEqual([font('res://b.tres')]);
  });

  it('lists a dependent reached by two paths once', () => {
    const graph = new DependencyGraph();
    graph.record(font('res://bold.tres'), 'res://base.ttf');
    graph.record(theme('res://ui.tres'), 'res://base.ttf');
    graph.record(theme('res://ui.tres'), 'res://bold.tres');

    expect(graph.release('res://base.ttf')).toEqual([font('res://bold.tres'), theme('res://ui.tres')]);
  });

  it('returns nothing for a file no dependent read', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://ui.tres'), 'res://body.ttf');

    expect(graph.release('res://other.ttf')).toEqual([]);
  });

  it('drops the released dependents’ edges, which their reload records again', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://ui.tres'), 'res://body.ttf');
    graph.release('res://body.ttf');

    expect(graph.release('res://body.ttf')).toEqual([]);
  });

  it('drops the edges of every dependent inside the changed file', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://ui.tres'), 'res://body.ttf');
    graph.release('res://ui.tres');

    expect(graph.release('res://body.ttf')).toEqual([]);
  });

  it('keeps one edge when the same read is recorded twice', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://ui.tres'), 'res://body.ttf');
    graph.record(theme('res://ui.tres'), 'res://body.ttf');

    expect(graph.release('res://body.ttf')).toEqual([theme('res://ui.tres')]);
  });

  it('tells the same key on two buses apart', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://x.tres'), 'res://body.ttf');
    graph.record(font('res://x.tres'), 'res://body.ttf');

    expect(graph.release('res://body.ttf')).toEqual([theme('res://x.tres'), font('res://x.tres')]);
  });
});

describe('DependencyGraph.prune', () => {
  it('drops a dependent no cache holds any more, so a later change does not reach it', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://evicted.tres'), 'res://body.ttf');
    graph.record(theme('res://ui.tres'), 'res://body.ttf');

    graph.prune((dependent) => dependent.key === 'res://ui.tres');

    expect(graph.release('res://body.ttf')).toEqual([theme('res://ui.tres')]);
  });
});

describe('DependencyGraph.clear', () => {
  it('forgets every edge', () => {
    const graph = new DependencyGraph();
    graph.record(theme('res://ui.tres'), 'res://body.ttf');
    graph.clear();

    expect(graph.release('res://body.ttf')).toEqual([]);
  });
});
