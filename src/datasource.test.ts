import { DataSource } from './datasource';

jest.mock('@grafana/runtime', () => ({
  DataSourceWithBackend: class {
    getResource = jest.fn(async () => ({ source: 'print(1)' }));
  },
  getTemplateSrv: () => ({
    getVariables: () => [{ name: 'portfolio_id' }, { name: 'base_currency' }],
    replace: (s: string) =>
      s.replace('$portfolio_id', 'demo').replace('$base_currency', 'USD'),
  }),
}));

jest.mock('./variables', () => ({ QSVariableSupport: class {} }));

function ds(): any {
  return new (DataSource as any)({ jsonData: {} });
}

test('applyTemplateVariables attaches a resolved vars map', () => {
  const out = ds().applyTemplateVariables({ refId: 'A', ref: 'yfinance-app/m' }, {});
  expect(out.vars).toEqual({ portfolio_id: 'demo', base_currency: 'USD' });
});

test('applyTemplateVariables still interpolates an inline override', () => {
  const out = ds().applyTemplateVariables(
    { refId: 'A', source: 'x = "$portfolio_id"' },
    {},
  );
  expect(out.source).toBe('x = "demo"');
});

test('filterQuery accepts a ref with no source', () => {
  expect(ds().filterQuery({ refId: 'A', ref: 'yfinance-app/m' })).toBe(true);
  expect(ds().filterQuery({ refId: 'A' })).toBe(false);
});

test('fetchMetricSource calls the resource endpoint', async () => {
  expect(await ds().fetchMetricSource('yfinance-app/m')).toBe('print(1)');
});
