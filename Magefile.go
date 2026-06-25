//go:build mage
// +build mage

package main

import (
	"os"
	"path/filepath"
	"strings"

	// mage:import
	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

// Default configures the default target.
var Default = build.BuildAll

// CopyFunctions mirrors functions/ into dist/ so the base library ships in the
// published bundle (webpack output.clean wipes dist/ of non-standard dirs).
// Run after the frontend build.
func CopyFunctions() error {
	src := "functions"
	dst := filepath.Join("dist", "functions")
	entries, err := os.ReadDir(src)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".py") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(src, e.Name()))
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(dst, e.Name()), b, 0o644); err != nil {
			return err
		}
	}
	return nil
}

func init() {
	// The datasource reads other plugins' encrypted SQLite via pluginclient,
	// which links mutecomm/go-sqlcipher (SQLCipher + OpenSSL) through CGO. The
	// SDK's default build sets CGO_ENABLED=0, which compiles the sqlite driver
	// as a non-functional stub ("requires cgo to work"); flip CGO on so the
	// driver is real.
	_ = build.SetBeforeBuildCallback(func(cfg build.Config) (build.Config, error) {
		cfg.EnableCGo = true
		return cfg, nil
	})
}
