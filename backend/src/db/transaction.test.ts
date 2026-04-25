import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withTransaction } from './transaction';
import type { Pool, PoolClient } from 'pg';

function createMockClient(overrides: Partial<PoolClient> = {}): PoolClient {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
    ...overrides,
  } as unknown as PoolClient;
}

function createMockPool(client: PoolClient): Pool {
  return { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
}

describe('withTransaction', () => {
  let client: PoolClient;
  let pool: Pool;

  beforeEach(() => {
    client = createMockClient();
    pool = createMockPool(client);
  });

  it('commits on success and returns the result', async () => {
    const result = await withTransaction(pool, async (c) => {
      await c.query('INSERT INTO users (name) VALUES ($1)', ['Alice']);
      return 42;
    });

    expect(result).toBe(42);
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back on failure and releases the client', async () => {
    await expect(
      withTransaction(pool, async () => {
        throw new Error('boom');
      }),
    ).rejects.toMatchObject({
      error: { code: 'DATABASE_ERROR' },
    });

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('retries up to 3 times with exponential backoff', async () => {
    let attempts = 0;
    const result = await withTransaction(pool, async () => {
      attempts++;
      if (attempts < 3) throw new Error('transient');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
    expect(pool.connect).toHaveBeenCalledTimes(3);
  });

  it('throws DATABASE_ERROR after all retries exhausted', async () => {
    await expect(
      withTransaction(pool, async () => {
        throw new Error('persistent failure');
      }),
    ).rejects.toMatchObject({
      error: {
        code: 'DATABASE_ERROR',
        message: expect.stringContaining('persistent failure'),
      },
    });

    expect(pool.connect).toHaveBeenCalledTimes(3);
  });

  it('does not commit partial data on failure', async () => {
    await expect(
      withTransaction(pool, async (c) => {
        await c.query('INSERT INTO users (name) VALUES ($1)', ['Alice']);
        throw new Error('second write failed');
      }),
    ).rejects.toMatchObject({ error: { code: 'DATABASE_ERROR' } });

    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
