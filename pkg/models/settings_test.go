package models

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func makeSettings(jsonData map[string]any, secureData map[string]string) backend.DataSourceInstanceSettings {
	jd, _ := json.Marshal(jsonData)
	return backend.DataSourceInstanceSettings{
		JSONData:                jd,
		DecryptedSecureJSONData: secureData,
	}
}

func TestLoadPluginSettings_PluginsRoot(t *testing.T) {
	s, err := LoadPluginSettings(makeSettings(
		map[string]any{"pluginsRoot": "/x/plugins"},
		nil,
	))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.PluginsRoot != "/x/plugins" {
		t.Errorf("PluginsRoot = %q, want %q", s.PluginsRoot, "/x/plugins")
	}
}

func TestLoadPluginSettings_PluginTokens(t *testing.T) {
	s, err := LoadPluginSettings(makeSettings(
		nil,
		map[string]string{"pluginTokens": `{"yfinance-app":"tok123"}`},
	))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := s.PluginTokens["yfinance-app"]; got != "tok123" {
		t.Errorf("PluginTokens[yfinance-app] = %q, want %q", got, "tok123")
	}
}

func TestLoadPluginSettings_AbsentPluginTokens(t *testing.T) {
	s, err := LoadPluginSettings(makeSettings(nil, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.PluginTokens == nil {
		t.Error("PluginTokens should be non-nil empty map when absent")
	}
	if len(s.PluginTokens) != 0 {
		t.Errorf("PluginTokens should be empty, got %v", s.PluginTokens)
	}
}

func TestLoadPluginSettings_MalformedPluginTokens(t *testing.T) {
	_, err := LoadPluginSettings(makeSettings(
		nil,
		map[string]string{"pluginTokens": `not-json`},
	))
	if err == nil {
		t.Error("expected error for malformed pluginTokens JSON, got nil")
	}
}
