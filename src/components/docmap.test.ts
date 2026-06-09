import { hoverMarkdown, summarize, docMap, type DocMap } from './docmap';

const fixture: DocMap = {
  twr: { signature: 'twr(navs, flows, t0, t1) -> float | None', doc: 'Time-weighted return over the window.' },
  bounds: { signature: 'bounds(flows, t0, t1) -> list[int]', doc: '' },
};

describe('hoverMarkdown', () => {
  it('returns signature + doc markdown for a known function', () => {
    const md = hoverMarkdown('twr', fixture);
    expect(md).toContain('```python');
    expect(md).toContain('twr(navs, flows, t0, t1)');
    expect(md).toContain('Time-weighted return');
  });

  it('returns just the signature when the doc is empty', () => {
    const md = hoverMarkdown('bounds', fixture);
    expect(md).toContain('bounds(flows, t0, t1)');
    expect(md).not.toContain('\n\n');
  });

  it('returns undefined for a builtin / local name (a miss)', () => {
    expect(hoverMarkdown('print', fixture)).toBeUndefined();
    expect(hoverMarkdown('my_local', fixture)).toBeUndefined();
  });

  it('resolves real bundled functions from the generated doc-map', () => {
    expect(hoverMarkdown('xirr')).toContain('xirr(');
    expect(hoverMarkdown('cumulative_twr')).toContain('cumulative_twr(');
    expect(hoverMarkdown('not_a_metric')).toBeUndefined();
  });
});

describe('summarize', () => {
  it('names the first metric call found', () => {
    expect(summarize('twr(a, b, c, d)', fixture)).toBe('twr(…)');
  });

  it('skips comments', () => {
    expect(summarize('# a comment\ntwr(x)', fixture)).toBe('twr(…)');
  });

  it('falls back to the first code line when no metric is called', () => {
    expect(summarize('x = 1 + 2', fixture)).toBe('x = 1 + 2');
  });

  it('handles empty source', () => {
    expect(summarize('', fixture)).toBe('No source yet');
    expect(summarize(undefined, fixture)).toBe('No source yet');
  });
});

describe('bundled docMap', () => {
  it('contains the public metric surface', () => {
    expect(docMap.twr).toBeDefined();
    expect(docMap.xirr).toBeDefined();
    expect(docMap.rolling_regression_stats).toBeDefined();
  });

  it('excludes private helpers', () => {
    expect(docMap.npv_at).toBeUndefined();
    expect(docMap._stats_from_sums).toBeUndefined();
  });
});
