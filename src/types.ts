import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface MyQuery extends DataQuery {
  source?: string; // inline Python override; empty when a ref supplies the metric
  ref?: string; // "pluginID/metric" — shipped metric reference
  vars?: Record<string, string>; // resolved dashboard vars, attached at query time
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
