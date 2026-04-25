// Database seed script — creates the first user and preference profile
// Run with: npm run build && npm run db:seed

import { Pool } from 'pg';

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('Seeding database...');

    // Check if a user already exists
    const existing = await pool.query('SELECT id FROM users LIMIT 1');
    if (existing.rows.length > 0) {
      console.log(`User already exists (id: ${existing.rows[0].id}). Skipping seed.`);
      console.log(`Use this id as your x-user-id header.`);
      await pool.end();
      return;
    }

    // Create user
    const userResult = await pool.query(
      `INSERT INTO users (name, email, timezone, onboarding_complete)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['Cog User', 'user@cog.app', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', true],
    );
    const userId = userResult.rows[0].id;
    console.log(`Created user: ${userId}`);

    // Create preference profile
    await pool.query(
      `INSERT INTO preference_profiles (user_id, wake_time, sleep_time, focus_windows, workout_windows, min_buffer_minutes, max_deep_work_minutes, default_commute_minutes, auto_repair_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        '07:00',
        '23:00',
        JSON.stringify([{ start: '09:00', end: '12:00' }]),
        JSON.stringify([{ start: '17:00', end: '18:30' }]),
        5,
        90,
        15,
        false,
      ],
    );
    console.log('Created default preference profile.');

    console.log('\nSeed complete!');
    console.log(`Your user id: ${userId}`);
    console.log('Set this as NEXT_PUBLIC_DEFAULT_USER_ID in your frontend env,');
    console.log('or use it as the x-user-id header in API requests.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
