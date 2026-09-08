-- Migration 013: Customer Email Auth Support
-- Allows email-based customer registration without requiring a mobile number.
-- ADDITIVE ONLY — no existing data, columns, or constraints are modified or dropped.

-- 1. Make mobile column nullable for email-only customer accounts
-- Existing mobile values remain unchanged. PostgreSQL UNIQUE allows multiple NULLs.
ALTER TABLE customer_accounts
ALTER COLUMN mobile DROP NOT NULL;

-- 2. Add index on email column for efficient email-based lookups
CREATE INDEX IF NOT EXISTS idx_customer_accounts_email
ON customer_accounts(email);
