-- Initialize database for local development
-- This script runs when PostgreSQL container is first created

-- Check and create database only if it doesn't exist
SELECT 'CREATE DATABASE moneyy' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'moneyy')\gexec
