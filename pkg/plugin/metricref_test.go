package plugin

import (
	"os"
	"path/filepath"
	"testing"
)

func TestIsMetricRef(t *testing.T) {
	yes := []string{"yfinance-app/sector_pnl", "core-app/equity_curve/total_return"}
	no := []string{
		"", "PNL = 1\n@metric()\ndef f(): ...", "def f(): return 1",
		"a{b}", "../etc/passwd", "yfinance-app/../core-app/x",
	}
	for _, s := range yes {
		if !isMetricRef(s) {
			t.Errorf("isMetricRef(%q) = false, want true", s)
		}
	}
	for _, s := range no {
		if isMetricRef(s) {
			t.Errorf("isMetricRef(%q) = true, want false", s)
		}
	}
}

func TestReadMetricSource(t *testing.T) {
	root := t.TempDir()
	mustWrite(t, filepath.Join(root, "yfinance-app", "library-panels", "sector_pnl.py"), "print('hi')")

	got, err := readMetricSource(root, "yfinance-app/sector_pnl")
	if err != nil {
		t.Fatalf("readMetricSource: %v", err)
	}
	if got != "print('hi')" {
		t.Errorf("got %q", got)
	}
}

func TestReadMetricSourceNotFound(t *testing.T) {
	if _, err := readMetricSource(t.TempDir(), "yfinance-app/missing"); err == nil {
		t.Fatal("expected not-found error")
	}
}

func TestReadMetricSourceRejectsTraversal(t *testing.T) {
	root := t.TempDir()
	mustWrite(t, filepath.Join(root, "secret.py"), "secret")
	for _, ref := range []string{"yfinance-app/../../secret", "../secret"} {
		if _, err := readMetricSource(root, ref); err == nil {
			t.Errorf("expected rejection for %q", ref)
		}
	}
}

func mustWrite(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestSubstituteVars(t *testing.T) {
	code := `sel = "x{portfolio=\"$portfolio_id\"}"; title = "${base_currency}"`
	out := substituteVars(code, map[string]string{
		"portfolio_id":  "demo",
		"base_currency": "USD",
	})
	want := `sel = "x{portfolio=\"demo\"}"; title = "USD"`
	if out != want {
		t.Errorf("got %q want %q", out, want)
	}
}

func TestSubstituteVarsLeavesUnknownAndEmpty(t *testing.T) {
	if got := substituteVars("a $unknown b", map[string]string{"x": "1"}); got != "a $unknown b" {
		t.Errorf("unknown token changed: %q", got)
	}
	if got := substituteVars("a $x b", nil); got != "a $x b" {
		t.Errorf("nil vars should be a no-op: %q", got)
	}
}

func TestSelectCode(t *testing.T) {
	root := t.TempDir()
	mustWrite(t, filepath.Join(root, "yfinance-app", "library-panels", "m.py"), "shipped")

	// override wins
	if got, _ := selectCode(panelModel{Source: "inline"}, root); got != "inline" {
		t.Errorf("override: got %q", got)
	}
	// ref read when no override
	if got, _ := selectCode(panelModel{Ref: "yfinance-app/m"}, root); got != "shipped" {
		t.Errorf("ref: got %q", got)
	}
	// neither -> error
	if _, err := selectCode(panelModel{}, root); err == nil {
		t.Error("empty model should error")
	}
}
