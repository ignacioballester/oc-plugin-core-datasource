package plugin

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// metricRefRe matches a bare metric reference "<pluginID>/<metric-path>".
// Real Python source never matches: it has whitespace, parens, or decorators.
var metricRefRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*(/[A-Za-z0-9_][A-Za-z0-9_-]*)+$`)

// isMetricRef reports whether s is a metric reference rather than inline Python.
func isMetricRef(s string) bool {
	s = strings.TrimSpace(s)
	if strings.Contains(s, "..") {
		return false
	}
	return metricRefRe.MatchString(s)
}

// resolveMetricPath maps "<pluginID>/<metric>" to the on-disk .py path under
// installRoot, refusing anything that escapes the plugin's library-panels dir.
func resolveMetricPath(installRoot, ref string) (string, error) {
	if !isMetricRef(ref) {
		return "", fmt.Errorf("not a metric ref: %q", ref)
	}
	pluginID, metric, _ := strings.Cut(strings.TrimSpace(ref), "/")
	base := filepath.Join(installRoot, pluginID, "library-panels")
	full := filepath.Join(base, filepath.FromSlash(metric)+".py")
	baseClean := filepath.Clean(base) + string(os.PathSeparator)
	if !strings.HasPrefix(filepath.Clean(full)+string(os.PathSeparator), baseClean) {
		return "", fmt.Errorf("metric ref escapes plugin dir: %q", ref)
	}
	return full, nil
}

// readMetricSource returns the shipped Python for a metric ref.
func readMetricSource(installRoot, ref string) (string, error) {
	p, err := resolveMetricPath(installRoot, ref)
	if err != nil {
		return "", err
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return "", fmt.Errorf("metric not found: %s", ref)
	}
	return string(b), nil
}

// pluginsInstallRoot returns the directory that contains every installed
// plugin's dir. override wins (desktop / tests); otherwise it is derived from
// this backend binary's location (<root>/<pluginID>/<binary>).
func pluginsInstallRoot(override string) (string, error) {
	if override != "" {
		return override, nil
	}
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(filepath.Dir(exe)), nil
}

// varTokenRe matches $name and ${name}. Only the captured name is used.
var varTokenRe = regexp.MustCompile(`\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)`)

// substituteVars replaces $name and ${name} tokens in code with values from
// vars. Unknown tokens are left intact. No Grafana format syntax is supported.
func substituteVars(code string, vars map[string]string) string {
	if len(vars) == 0 {
		return code
	}
	return varTokenRe.ReplaceAllStringFunc(code, func(m string) string {
		sub := varTokenRe.FindStringSubmatch(m)
		name := sub[1]
		if name == "" {
			name = sub[2]
		}
		if v, ok := vars[name]; ok {
			return v
		}
		return m
	})
}

// loadFunctions returns the helper Python prepended to a panel source: the base
// library shipped beside the datasource binary (baseDir), then the owning
// plugin's functions/ when ref is a metric ref. Missing dirs are skipped; this
// never errors (a broken helper surfaces later as a compute error).
func loadFunctions(baseDir, installRoot, ref string) string {
	var b strings.Builder
	appendFunctionsDir(&b, baseDir)
	if isMetricRef(ref) {
		pluginID, _, _ := strings.Cut(strings.TrimSpace(ref), "/")
		appendFunctionsDir(&b, filepath.Join(installRoot, pluginID, "functions"))
	}
	return b.String()
}

// appendFunctionsDir appends every *.py in dir (sorted) to b, each followed by
// a newline. A missing/unreadable dir is a silent skip.
func appendFunctionsDir(b *strings.Builder, dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".py") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	for _, n := range names {
		if data, err := os.ReadFile(filepath.Join(dir, n)); err == nil {
			b.Write(data)
			b.WriteString("\n")
		}
	}
}

// selectCode picks the code to run for a query: an inline override wins;
// otherwise a ref is read from disk; an empty model is an error.
func selectCode(pm panelModel, installRoot string) (string, error) {
	if strings.TrimSpace(pm.Source) != "" {
		return pm.Source, nil
	}
	if pm.Ref != "" {
		return readMetricSource(installRoot, pm.Ref)
	}
	return "", fmt.Errorf("query has neither source nor ref")
}

