package plugin

import (
	"testing"

	_ "github.com/mutecomm/go-sqlcipher/v4"
)

func TestReadRows(t *testing.T) {
	db := newTestDB(t)

	frame, err := readRows(t.Context(), db,
		"SELECT portfolio, instrument_id, ts, sector FROM gw_thing ORDER BY ts ASC",
		nil,
	)
	if err != nil {
		t.Fatalf("readRows: %v", err)
	}

	wantCols := []string{"portfolio", "instrument_id", "ts", "sector"}
	if len(frame.Columns) != len(wantCols) {
		t.Fatalf("columns: got %v, want %v", frame.Columns, wantCols)
	}
	for i, c := range frame.Columns {
		if c != wantCols[i] {
			t.Errorf("col[%d]: got %q, want %q", i, c, wantCols[i])
		}
	}

	if len(frame.Rows) != 5 {
		t.Errorf("expected 5 rows, got %d", len(frame.Rows))
	}

	// TEXT columns from SQLite may come back as []byte — verify coercion to string.
	for i, row := range frame.Rows {
		if _, ok := row[0].(string); !ok {
			t.Errorf("row %d col 0: expected string, got %T", i, row[0])
		}
	}
}

func TestReadRowsEmptyIsNonNil(t *testing.T) {
	db := newTestDB(t)
	frame, err := readRows(t.Context(), db,
		"SELECT portfolio, instrument_id, ts, sector FROM gw_thing WHERE portfolio = 'nope'",
		nil,
	)
	if err != nil {
		t.Fatalf("readRows: %v", err)
	}
	// A nil slice marshals to JSON null; the compute sidecar requires a list.
	if frame.Rows == nil {
		t.Fatal("empty result must have a non-nil Rows slice (nil -> JSON null, rejected by compute)")
	}
	if len(frame.Rows) != 0 {
		t.Errorf("expected 0 rows, got %d", len(frame.Rows))
	}
}
