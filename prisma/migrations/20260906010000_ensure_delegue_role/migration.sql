-- Ensure delegated accounts can be created on databases initialized before this role was introduced.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DELEGUE';
