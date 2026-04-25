-- 001_initial_schema.sql
-- Initial database schema for Cog Life Scheduler
-- Requirement 12.4: Persist all entity records to PostgreSQL

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    onboarding_complete BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE preference_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    wake_time TIME NOT NULL DEFAULT '07:00',
    sleep_time TIME NOT NULL DEFAULT '23:00',
    focus_windows JSONB NOT NULL DEFAULT '[]',
    workout_windows JSONB NOT NULL DEFAULT '[]',
    min_buffer_minutes INT NOT NULL DEFAULT 5 CHECK (min_buffer_minutes >= 0),
    max_deep_work_minutes INT NOT NULL DEFAULT 90,
    default_commute_minutes INT NOT NULL DEFAULT 15,
    auto_repair_enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    label VARCHAR(100),
    type VARCHAR(50) NOT NULL
);

CREATE TABLE travel_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    destination_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    travel_minutes INT NOT NULL CHECK (travel_minutes > 0),
    UNIQUE(origin_id, destination_id)
);

CREATE TABLE fixed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    recurrence_rule VARCHAR(255),
    recurrence_parent_id UUID REFERENCES fixed_events(id) ON DELETE CASCADE,
    category VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);

CREATE TABLE flexible_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    estimated_minutes INT NOT NULL CHECK (estimated_minutes > 0),
    min_session_minutes INT NOT NULL DEFAULT 15,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    due_date DATE,
    energy_requirement VARCHAR(20) DEFAULT 'medium',
    preferred_window JSONB,
    remaining_minutes INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (min_session_minutes <= estimated_minutes)
);

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    deadline TIMESTAMPTZ NOT NULL,
    estimated_total_minutes INT NOT NULL CHECK (estimated_total_minutes > 0),
    progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    urgency_score FLOAT NOT NULL DEFAULT 0,
    remaining_minutes INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE schedule_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    version INT NOT NULL DEFAULT 1,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, plan_date, version)
);

CREATE TABLE schedule_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES schedule_plans(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    source_id UUID,
    title VARCHAR(255) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    locked BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL,
    CHECK (end_time > start_time)
);

CREATE TABLE explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL UNIQUE REFERENCES schedule_blocks(id) ON DELETE CASCADE,
    explanation_text TEXT NOT NULL,
    referenced_constraints JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_fixed_events_user_date ON fixed_events(user_id, event_date);
CREATE INDEX idx_flexible_tasks_user ON flexible_tasks(user_id);
CREATE INDEX idx_assignments_user_deadline ON assignments(user_id, deadline);
CREATE INDEX idx_schedule_plans_user_date ON schedule_plans(user_id, plan_date);
CREATE INDEX idx_schedule_blocks_plan ON schedule_blocks(plan_id);
CREATE INDEX idx_travel_rules_user ON travel_rules(user_id);
