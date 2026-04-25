// Database transaction helper with retry and structured error handling
// Requirements: 12.5

import { Pool, PoolClient } from 'pg';
import type { ErrorResponse } from '../types/api';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

function makeDatabaseError(message: string): ErrorResponse {
  return {
    error: {
      code: 'DATABASE_ERROR',
      message,
    },
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `fn` inside a database transaction with automatic rollback on
 * failure and connection retry logic (3 attempts, exponential backoff).
 *
 * Returns the value produced by `fn` on success, or throws an
 * `ErrorResponse`-shaped object on failure with no partial data committed.
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      lastError = err;
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // rollback failed — nothing more we can do
        }
      }
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    } finally {
      client?.release();
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : 'Unknown database error';
  throw makeDatabaseError(`Transaction failed after ${MAX_RETRIES} attempts: ${message}`);
}
