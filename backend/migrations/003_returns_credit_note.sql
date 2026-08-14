-- =============================================================
-- Migration 003: Returns credit note support
-- Adds credit_remaining column and reason column to Returns
-- =============================================================

SET NAMES utf8mb4;

ALTER TABLE Returns
  ADD COLUMN credit_remaining DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER total_refund,
  ADD COLUMN reason VARCHAR(255) NULL AFTER refund_method;
