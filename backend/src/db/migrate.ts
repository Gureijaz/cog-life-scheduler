// Database migration runner
// Run with: npm run build && npm run db:migrate

import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('Running migrations...');

    const migrationPath = join(__dirname, 'migrations', '001_initial_schema.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    await pool.query(sql);
    console.log('Migration 001_initial_schema.sql applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
