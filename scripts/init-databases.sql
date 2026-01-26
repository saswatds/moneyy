-- Initialize database for local development
-- This script runs when PostgreSQL container is first created

-- Check and create database only if it doesn't exist
SELECT 'CREATE DATABASE money' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'money')\gexec
