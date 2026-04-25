// Generic repository base class over pg Pool
// Requirements: 12.1, 12.2, 12.4

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { toCamelCaseKeys, toSnakeCase } from './serializer';

export interface ColumnMapping {
  /** camelCase property name → snake_case column name */
  [camelKey: string]: string;
}

/**
 * Build a default column mapping from an array of camelCase property names.
 */
export function buildColumnMapping(camelKeys: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const key of camelKeys) {
    mapping[key] = toSnakeCase(key);
  }
  return mapping;
}

export class Repository<T extends { id: string }> {
  constructor(
    protected pool: Pool,
    protected tableName: string,
    protected columnMapping: ColumnMapping
  ) {}

  async findById(id: string): Promise<T | null> {
    const result = await this.pool.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return toCamelCaseKeys<T>(result.rows[0]);
  }

  async findMany(filter: Record<string, unknown> = {}): Promise<T[]> {
    const entries = Object.entries(filter);
    if (entries.length === 0) {
      const result = await this.pool.query(`SELECT * FROM ${this.tableName}`);
      return result.rows.map((row) => toCamelCaseKeys<T>(row));
    }

    const conditions = entries.map(([key, _], i) => {
      const col = this.columnMapping[key] ?? toSnakeCase(key);
      return `${col} = $${i + 1}`;
    });
    const values = entries.map(([, v]) => v);

    const result = await this.pool.query(
      `SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`,
      values
    );
    return result.rows.map((row) => toCamelCaseKeys<T>(row));
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const id = uuidv4();
    const dataWithId = { id, ...data } as Record<string, unknown>;

    const columns: string[] = [];
    const placeholders: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [camelKey, value] of Object.entries(dataWithId)) {
      if (value === undefined) continue;
      const col = this.columnMapping[camelKey] ?? toSnakeCase(camelKey);
      columns.push(col);
      placeholders.push(`$${idx}`);
      values.push(this.serializeValue(value));
      idx++;
    }

    const result = await this.pool.query(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    return toCamelCaseKeys<T>(result.rows[0]);
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const entries = Object.entries(data as Record<string, unknown>).filter(
      ([, v]) => v !== undefined
    );
    if (entries.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`${this.tableName} with id ${id} not found`);
      return existing;
    }

    const setClauses = entries.map(([key, _], i) => {
      const col = this.columnMapping[key] ?? toSnakeCase(key);
      return `${col} = $${i + 1}`;
    });
    const values = entries.map(([, v]) => this.serializeValue(v));
    values.push(id);

    const result = await this.pool.query(
      `UPDATE ${this.tableName} SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      throw new Error(`${this.tableName} with id ${id} not found`);
    }
    return toCamelCaseKeys<T>(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
  }

  /**
   * Serialize a value for insertion into the database.
   * Arrays and plain objects are JSON-stringified for JSONB columns.
   */
  protected serializeValue(value: unknown): unknown {
    if (Array.isArray(value) || (value !== null && typeof value === 'object' && !(value instanceof Date))) {
      return JSON.stringify(value);
    }
    return value;
  }
}
