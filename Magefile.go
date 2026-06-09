//go:build mage
// +build mage

package main

import (
	// mage:import
	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

// Default configures the default target.
var Default = build.BuildAll

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
