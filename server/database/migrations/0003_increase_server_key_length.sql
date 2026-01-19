-- Migration: Increase server_key column length for encrypted data
-- Created: 2026-01-19

-- Increase server_key length to accommodate encrypted data format (salt:iv:tag:encrypted)
ALTER TABLE integration_settings 
ALTER COLUMN server_key TYPE VARCHAR(500);

-- Add comment to document the change
COMMENT ON COLUMN integration_settings.server_key IS 'Encrypted API server key (format: salt:iv:tag:encrypted)';
