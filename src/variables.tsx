import React, { ChangeEvent } from 'react';
import { CustomVariableSupport, DataQueryRequest, MetricFindValue } from '@grafana/data';
import { InlineField, TextArea } from '@grafana/ui';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

import { DataSource } from './datasource';
import { MyVariableQuery } from './types';

// ---- Variable query editor ------------------------------------------------

interface EditorProps {
  query: MyVariableQuery;
  onChange: (query: MyVariableQuery, definition: string) => void;
}

function VariableQueryEditor({ query, onChange }: EditorProps) {
  const [source, setSource] = React.useState(query.source ?? '');

  const save = () => {
    onChange({ ...query, source }, source);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setSource(e.currentTarget.value);
  };

  return (
    <InlineField label="Source" labelWidth={14} tooltip="Python @metric source (e.g. a passthrough over portfolios{})">
      <TextArea
        aria-label="Variable source"
        placeholder={'@bind(rows="portfolios{}")\n@metric(output="table")\ndef passthrough(rows):\n    return rows'}
        value={source}
        onChange={handleChange}
        onBlur={save}
        rows={6}
        cols={60}
      />
    </InlineField>
  );
}

// ---- CustomVariableSupport ------------------------------------------------

export class QSVariableSupport extends CustomVariableSupport<DataSource, MyVariableQuery> {
  editor = VariableQueryEditor;

  constructor(private ds: DataSource) {
    super();
  }

  query(request: DataQueryRequest<MyVariableQuery>): Observable<{ data: MetricFindValue[] }> {
    const [q] = request.targets;
    const result = this.ds.metricFindQuery(q, {
      scopedVars: request.scopedVars,
      range: request.range,
    });
    return from(result).pipe(map((data) => ({ data })));
  }
}
