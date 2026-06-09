import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QueryEditorProps, GrafanaTheme2 } from '@grafana/data';
import { Button, CodeEditor, Drawer, useStyles2 } from '@grafana/ui';
import type { Monaco } from '@grafana/ui';
import { css } from '@emotion/css';

import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';
import { docMap, hoverMarkdown, summarize } from './docmap';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

/**
 * Compact button + summary that opens a right-side Drawer hosting a
 * full-height Monaco Python editor for `query.source`.
 *
 * The source is committed (onChange → onRunQuery) on blur, on Cmd/Ctrl+S, and
 * when the drawer closes — never per keystroke. The live editor value is held
 * in a ref so closing the drawer always commits the latest text.
 */
export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const styles = useStyles2(getStyles);
  const [open, setOpen] = useState(false);
  const liveSource = useRef(query.source ?? '');

  // In the desktop WKWebView, Monaco's automaticLayout collapses the editor to
  // ~5px inside the Drawer — the vh/percentage container height never resolves
  // there (it works in Chrome, which does resolve it). So drive the size
  // explicitly: a concrete pixel container height here, plus automaticLayout
  // OFF and editor.layout({width,height}) with real pixels in onEditorDidMount.
  const editorHeight = Math.max(
    320,
    (typeof window !== 'undefined' ? window.innerHeight : 900) - 130,
  );

  // Re-seed the live ref from props each time the drawer opens, so a close-commit
  // never reverts an edit made externally (e.g. dashboard undo) while it was shut.
  useEffect(() => {
    if (open) {
      liveSource.current = query.source ?? '';
    }
  }, [open, query.source]);

  const commit = useCallback(
    (source: string) => {
      liveSource.current = source;
      if (source === (query.source ?? '')) {
        return;
      }
      onChange({ ...query, source });
      onRunQuery();
    },
    [query, onChange, onRunQuery],
  );

  const onBeforeEditorMount = useCallback((monaco: Monaco) => {
    registerPythonHover(monaco);
  }, []);

  return (
    <div className={styles.wrap}>
      <Button
        variant="secondary"
        icon="brackets-curly"
        onClick={() => setOpen(true)}
        aria-label="Edit Python source"
      >
        {'</> Edit Python source'}
      </Button>
      <span className={styles.summary} title={query.source ?? ''}>
        {summarize(query.source)}
      </span>

      {open && (
        <Drawer
          title="Python source"
          subtitle="Hover a metric function for its signature and docstring."
          size="md"
          scrollableContent={false}
          onClose={() => {
            commit(liveSource.current);
            setOpen(false);
          }}
        >
          <div style={{ height: editorHeight, width: '100%' }}>
            <CodeEditor
              value={query.source ?? ''}
              language="python"
              width="100%"
              height={editorHeight}
              showMiniMap={false}
              showLineNumbers
              monacoOptions={{ automaticLayout: false, scrollBeyondLastLine: false }}
              onBeforeEditorMount={onBeforeEditorMount}
              onEditorDidMount={(editor) => {
                // automaticLayout collapses to ~5px in this WebKit, so it is OFF.
                // Size the editor explicitly with real pixels instead, and keep
                // it sized on window resize. Width comes from the live container;
                // height from the viewport. Listener is removed on dispose.
                const relayout = () => {
                  const node = editor.getContainerDomNode?.();
                  if (!node) {
                    return;
                  }
                  // Grafana's CodeEditor wrappers size to content and Monaco
                  // sizes to the wrapper, so in WebKit (which doesn't resolve the
                  // Drawer's % height) they collapse each other to ~5px. Pin a
                  // concrete pixel height onto the editor node AND its wrappers
                  // to break the cycle, then lay out explicitly.
                  let el: HTMLElement | null = node;
                  for (let i = 0; i < 4 && el; i++) {
                    el.style.height = `${editorHeight}px`;
                    el = el.parentElement;
                  }
                  const w = node.clientWidth || Math.round(window.innerWidth * 0.45);
                  editor.layout({ width: w, height: editorHeight });
                };
                relayout();
                // A couple of deferred passes: the Drawer's open transition can
                // leave the container width unresolved on the first frame.
                setTimeout(relayout, 60);
                setTimeout(relayout, 250);
                window.addEventListener('resize', relayout);
                editor.onDidDispose(() => window.removeEventListener('resize', relayout));
              }}
              onChange={(v) => {
                liveSource.current = v;
              }}
              onBlur={(v) => commit(v)}
              onSave={(v) => commit(v)}
            />
          </div>
        </Drawer>
      )}
    </div>
  );
}

let hoverRegistered = false;

/**
 * Register a native Monaco hover provider for Python that resolves the word
 * under the cursor against the bundled metric doc-map. Returns nothing on a
 * miss (builtins, locals). Idempotent across editor mounts.
 */
function registerPythonHover(monaco: Monaco) {
  if (hoverRegistered) {
    return;
  }
  hoverRegistered = true;
  monaco.languages.registerHoverProvider('python', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) {
        return null;
      }
      const md = hoverMarkdown(word.word, docMap);
      if (!md) {
        return null;
      }
      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        ),
        contents: [{ value: md }],
      };
    },
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    flex-wrap: wrap;
  `,
  summary: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
  `,
});
