import { DataSourceInstanceSettings, CoreApp, ScopedVars, MetricFindValue } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';

import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY, MyVariableQuery } from './types';
import { QSVariableSupport } from './variables';

export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.variables = new QSVariableSupport(this);
  }

  getDefaultQuery(_: CoreApp): Partial<MyQuery> {
    return DEFAULT_QUERY;
  }

  // Resolve every dashboard variable to a {name: value} map the backend
  // substitutes into the (possibly ref-resolved) Python. An inline override is
  // still interpolated directly so ad-hoc Explore queries behave as before.
  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars): MyQuery {
    const srv = getTemplateSrv();
    const vars: Record<string, string> = {};
    for (const v of srv.getVariables()) {
      const name = (v as { name: string }).name;
      vars[name] = srv.replace('$' + name, scopedVars);
    }
    return {
      ...query,
      source: query.source ? srv.replace(query.source, scopedVars) : query.source,
      vars,
    };
  }

  filterQuery(query: MyQuery): boolean {
    return (query.source ?? '').trim() !== '' || (query.ref ?? '').trim() !== '';
  }

  // fetchMetricSource returns the plugin-shipped Python for a ref, for the
  // query editor to display and to reset overrides.
  async fetchMetricSource(ref: string): Promise<string> {
    const res = await this.getResource('metric-source', { ref });
    return (res?.source as string) ?? '';
  }

  // metricFindQuery powers the CustomVariableSupport. Runs the source
  // through the normal backend path and maps the returned frame to
  // MetricFindValue[].
  async metricFindQuery(
    variableQuery: MyVariableQuery | string,
    options?: { scopedVars?: ScopedVars; range?: any },
  ): Promise<MetricFindValue[]> {
    const rawSource =
      typeof variableQuery === 'string' ? variableQuery : (variableQuery?.source ?? '');
    const source = getTemplateSrv().replace(rawSource, options?.scopedVars ?? {});

    if (!source.trim()) {
      return [];
    }

    const query: MyQuery = { refId: 'V', source };

    const { from: timeFrom, to: timeTo } =
      options?.range ?? { from: new Date(0), to: new Date() };

    // Build a minimal DataQueryRequest to hand to the backend's query path.
    const request = {
      requestId: 'variable',
      targets: [query],
      range: options?.range ?? { from: timeFrom, to: timeTo, raw: { from: 'now-1h', to: 'now' } },
      scopedVars: options?.scopedVars ?? {},
      timezone: 'browser',
      app: 'dashboard',
      startTime: Date.now(),
      intervalMs: 60000,
      maxDataPoints: 1000,
    } as any;

    return new Promise((resolve) => {
      this.query(request).subscribe({
        next: (resp) => {
          const frame = resp.data?.[0];
          if (!frame || !frame.fields?.length) {
            resolve([]);
            return;
          }

          const fields: Array<{ name: string; values: any }> = frame.fields;
          const nameField = fields.find((f) => f.name === 'name');
          const portfolioIdField = fields.find((f) => f.name === 'portfolio_id');
          const firstField = fields[0];

          const len: number =
            (firstField?.values as any)?.length ??
            (Array.isArray(firstField?.values) ? firstField.values.length : 0);

          const getValue = (field: { values: any }, i: number): unknown => {
            if (typeof field.values?.get === 'function') {
              return field.values.get(i);
            }
            return Array.isArray(field.values) ? field.values[i] : undefined;
          };

          const results: MetricFindValue[] = [];
          for (let i = 0; i < len; i++) {
            let text: string;
            let value: string;
            if (nameField && portfolioIdField) {
              // portfolios{} case: text=name, value=portfolio_id
              text = String(getValue(nameField, i) ?? '');
              value = String(getValue(portfolioIdField, i) ?? '');
            } else if (nameField) {
              text = String(getValue(nameField, i) ?? '');
              value = String(getValue(firstField, i) ?? '');
            } else {
              const v = String(getValue(firstField, i) ?? '');
              text = v;
              value = v;
            }
            results.push({ text, value });
          }
          resolve(results);
        },
        error: () => resolve([]),
      });
    });
  }
}
