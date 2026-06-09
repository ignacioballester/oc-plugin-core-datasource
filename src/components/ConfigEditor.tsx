import React, { ChangeEvent } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  const { jsonData } = options;

  const onReadGatewayUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: { ...jsonData, readGatewayUrl: event.target.value },
    });
  };

  return (
    <InlineField
      label="Read-gateway URL"
      labelWidth={20}
      interactive
      tooltip="HTTP base URL of the read-gateway service, e.g. http://read-gateway:8080"
    >
      <Input
        id="config-editor-read-gateway-url"
        onChange={onReadGatewayUrlChange}
        value={jsonData.readGatewayUrl ?? ''}
        placeholder="http://read-gateway:8080"
        width={50}
      />
    </InlineField>
  );
}
