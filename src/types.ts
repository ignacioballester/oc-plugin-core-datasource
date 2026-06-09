import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface MyQuery extends DataQuery {
  source?: string; // Python compute source; @bind / @metric live inside it
}

export const DEFAULT_QUERY: Partial<MyQuery> = {};

export interface MyDataSourceOptions extends DataSourceJsonData {
  readGatewayUrl?: string;
}

// Variable query — a Python @metric source (e.g. a declared passthrough over
// `portfolios{}`), run through the same compute path as panels. Inlined by the
// dashboard build from the metric the variable references.
export interface MyVariableQuery extends DataQuery {
  source: string;
}
