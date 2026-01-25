package sync

import (
	"context"
	"fmt"
	"time"
)

// TriggerConnectionSync triggers a full sync for a connection
//
//encore:api public path=/sync/connections/:id/sync method=POST
func TriggerConnectionSync(ctx context.Context, id string) (*TriggerSyncResponse, error) {
	// Get connection details
	var conn struct {
		UserID string
	}

	err := db.QueryRow(ctx, `
		SELECT user_id
		FROM sync_credentials
		WHERE id = $1
	`, id).Scan(&conn.UserID)

	if err != nil {
		return nil, fmt.Errorf("connection not found: %w", err)
	}

	// Trigger sync in background
	go func() {
		bgCtx := context.Background()

		// Update connection status
		_, _ = db.Exec(bgCtx, `
			UPDATE sync_credentials
			SET status = $1, updated_at = $2
			WHERE id = $3
		`, StatusSyncing, time.Now(), id)

		// Perform initial sync
		err := performInitialSync(bgCtx, conn.UserID, id)

		if err != nil {
			// Update connection with error
			_, _ = db.Exec(bgCtx, `
				UPDATE sync_credentials
				SET status = $1, last_sync_error = $2, updated_at = $3
				WHERE id = $4
			`, StatusError, err.Error(), time.Now(), id)
		}
	}()

	return &TriggerSyncResponse{
		ConnectionID: id,
		Status:       SyncStatusPending,
		Message:      "Sync started in background",
	}, nil
}
