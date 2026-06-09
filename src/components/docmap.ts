import functionsJson from './functions.json';

export interface FunctionDoc {
  signature: string;
  doc: string;
}

export type DocMap = Record<string, FunctionDoc>;

export const docMap: DocMap = functionsJson as DocMap;

/**
 * Markdown shown in the Monaco hover popover for a metric function, or
 * `undefined` when `word` is not a known public metric (a builtin, a local
 * variable, etc. — the hover provider returns nothing on a miss).
 */
export function hoverMarkdown(word: string, map: DocMap = docMap): string | undefined {
  const entry = map[word];
  if (!entry) {
    return undefined;
  }
  const sig = '```python\n' + entry.signature + '\n```';
  return entry.doc ? `${sig}\n\n${entry.doc}` : sig;
}

/**
 * One-line summary of a Python `source` for the compact editor button:
 * the first metric function call found, else the first non-comment line,
 * else a placeholder.
 */
export function summarize(source: string | undefined, map: DocMap = docMap): string {
  const text = (source ?? '').trim();
  if (!text) {
    return 'No source yet';
  }
  const names = Object.keys(map);
  for (const line of text.split('\n')) {
    const code = line.trim();
    if (!code || code.startsWith('#')) {
      continue;
    }
    for (const name of names) {
      const re = new RegExp(`\\b${name}\\s*\\(`);
      if (re.test(code)) {
        return `${name}(…)`;
      }
    }
    return code.length > 60 ? code.slice(0, 57) + '…' : code;
  }
  return 'No source yet';
}
