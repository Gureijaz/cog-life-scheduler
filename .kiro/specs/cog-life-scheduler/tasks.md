# Implementation Plan: Cog Life Scheduler

## Overview

Build the Cog life scheduler as a Node.js/Express backend with a PostgreSQL database, a constraint-based scheduling engine, an AI assistant layer, and a Next.js frontend. Tasks are ordered so each step builds on the previous: project scaffolding → domain types → database → repositories → engine → services → API → AI assistant → frontend → final integration.

## Tasks

- [x] 1. Project scaffolding and core domain types
  - [x] 1.1 Initialize monorepo with backend (Node.js + Express + TypeScript) and frontend (Next.js + TypeScript) packages
    - Set up `package.json`, `tsconfig.json`, ESLint, Prettier for both packages
    - Install core dependencies: express, pg, uuid, fast-check (dev), vitest (dev)
    - Install frontend dependencies: next, react, react-dom
    - _Requirements: 13.1_

  - [x] 1.2 Define all domain types and interfaces
    - Create `src/types/domain.ts` with `User`, `PreferenceProfile`, `FixedEvent`, `FlexibleTask`, `Assignment`, `Location`, `TravelRule`, `SchedulePlan`, `ScheduleBlock`, `Explanation`, enums (`Priority`, `EnergyLevel`, `SourceType`), and `TimeWindow`
    - Create `src/types/engine.ts` with `ScheduleInput`, `ScheduleResult`, `RepairResult`, `ChangeSummary`, `UnscheduledItem`, `ConflictWarning`, `AtRiskAssignment`
    - Create `src/types/api.ts` with request/response DTOs, error response format, and `AIResponse` interface
    - _Requirements: 12.1, 13.1_

  - [x] 1.3 Implement input validation functions
    - Create `src/validation/` module with validators for: wake/sleep time pair, fixed event time range, flexible task session/duration, assignment fields, preference profile fields, due date not in past, progress 0-100 range, negative buffer rejection
    - Return structured validation error objects with field name, reason, and value
    - _Requirements: 1.4, 1.5, 2.2, 3.2, 3.3, 3.7, 4.1, 13.6_

  - [x] 1.4 Write property tests for validation functions
    - **Property 1: Wake/Sleep Time Validation** — generate random time pairs and verify acceptance iff wake is logically before sleep within the same waking day
    - **Validates: Requirements 1.4**
    - **Property 2: Fixed Event Time Validation** — generate random start/end pairs and verify acceptance iff end > start
    - **Validates: Requirements 2.2**
    - **Property 7: Task Session/Duration Validation** — generate random task inputs and verify rejection iff min session > estimated duration
    - **Validates: Requirements 3.3**


- [x] 2. Database schema and repository layer
  - [x] 2.1 Create PostgreSQL migration with full schema
    - Create migration file with all tables: `users`, `preference_profiles`, `locations`, `travel_rules`, `fixed_events`, `flexible_tasks`, `assignments`, `schedule_plans`, `schedule_blocks`, `explanations`
    - Include all CHECK constraints, UNIQUE constraints, foreign keys, and indexes as defined in the design
    - _Requirements: 12.4_

  - [x] 2.2 Implement generic repository base and entity repositories
    - Create `src/repositories/base.ts` with generic `Repository<T>` implementing `findById`, `findMany`, `create`, `update`, `delete` over pg pool
    - Create typed repositories: `UserRepository`, `PreferenceProfileRepository`, `FixedEventRepository`, `FlexibleTaskRepository`, `AssignmentRepository`, `LocationRepository`, `TravelRuleRepository`, `SchedulePlanRepository`, `ScheduleBlockRepository`, `ExplanationRepository`
    - Implement camelCase ↔ snake_case serialization in a `src/repositories/serializer.ts` module
    - _Requirements: 12.1, 12.2, 12.4_

  - [x] 2.3 Implement database transaction support and error handling
    - Create `src/db/transaction.ts` with a `withTransaction` helper that wraps multi-table writes in a transaction and rolls back on failure
    - Implement connection retry logic (3 attempts, exponential backoff)
    - Return structured `DATABASE_ERROR` on failure with no partial data committed
    - _Requirements: 12.5_

  - [x] 2.4 Write property test for serialization round-trip
    - **Property 26: Schedule Plan Serialization Round Trip** — generate random valid `SchedulePlan` objects, serialize to JSON, deserialize back, and verify deep equality
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Scheduling engine — urgency and travel calculators
  - [x] 4.1 Implement urgency calculator
    - Create `src/engine/urgency.ts` implementing `UrgencyCalculator` interface
    - Compute `urgencyScore = remainingMinutes / minutesUntilDeadline`, clamped to [0, 1]
    - `remainingMinutes = totalMinutes × (1 − progressPercent / 100)`
    - Handle edge cases: deadline passed (score = 1.0), zero remaining work (score = 0)
    - _Requirements: 4.2, 4.3, 4.6_

  - [x] 4.2 Write property tests for urgency calculator
    - **Property 10: Urgency Score Computation** — generate random assignments and verify score equals `remainingMinutes / minutesUntilDeadline` clamped to [0, 1], and that progress updates correctly recalculate remaining minutes
    - **Validates: Requirements 4.2, 4.6**
    - **Property 11: Urgency Score Monotonicity** — generate an assignment at two times t1 < t2 (both before deadline) and verify `urgencyScore(t2) >= urgencyScore(t1)`
    - **Validates: Requirements 4.3**

  - [x] 4.3 Implement travel calculator
    - Create `src/engine/travel.ts` implementing `TravelCalculator` interface
    - Look up travel time from `TravelRule[]` by origin/destination pair
    - Fall back to `defaultCommuteMinutes` from preferences when no rule exists
    - _Requirements: 5.3, 5.4_

  - [x] 4.4 Write unit tests for travel calculator
    - Test lookup with matching rule, reverse direction, missing rule fallback to default, and zero-travel same-location case
    - _Requirements: 5.3, 5.4_


- [x] 5. Scheduling engine — constraint solver (Phases 1–7)
  - [x] 5.1 Implement Phase 1 (Place Hard Constraints) and Phase 2 (Compute Urgency)
    - Create `src/engine/solver.ts` implementing `SchedulingEngine.solve()`
    - Phase 1: Insert all `FixedEvent` and `LockedBlock` entries as immovable blocks
    - Phase 2: Compute urgency scores for all assignments, sort descending
    - _Requirements: 2.7, 6.2, 4.2, 4.4_

  - [x] 5.2 Implement Phase 3 (Place Deadline-Critical Items) and Phase 4 (Insert Travel Buffers)
    - Phase 3: Allocate blocks for high-urgency assignments working backward from deadlines; never place assignment blocks after their deadline
    - Phase 4: For every pair of adjacent blocks at different locations, insert travel buffer blocks using travel rules or default commute time
    - _Requirements: 4.4, 4.5, 5.3, 5.4, 5.5_

  - [x] 5.3 Implement Phase 5 (Apply Wellbeing Constraints) and Phase 6 (Place Remaining Items)
    - Phase 5: Enforce sleep windows (no blocks between sleep time and wake time), max deep work block limits, minimum buffer times between non-travel blocks
    - Phase 6: Fill remaining gaps with flexible tasks and lower-urgency assignments, respecting preference windows (focus hours, workout windows) as soft constraints; place higher-priority items first
    - _Requirements: 6.3, 6.4, 6.5, 3.4, 3.5, 6.6_

  - [x] 5.4 Implement Phase 7 (Generate Explanations) and unscheduled item reporting
    - Phase 7: For each placed block, generate an `Explanation` record referencing the specific constraints and preferences that influenced placement
    - When blocks are placed suboptimally, explain which constraints prevented optimal placement and what tradeoffs were made
    - Collect all items that could not be scheduled and return them in `ScheduleResult.unscheduledItems`
    - Compute at-risk assignments (shortfall = remaining minutes − available schedulable minutes) and include in result
    - _Requirements: 6.7, 9.1, 9.3, 9.5, 6.6, 4.7_

  - [x] 5.5 Write property tests for scheduler invariants
    - **Property 6: Fixed Events Are Immovable Hard Constraints** — verify every fixed event appears at its exact time and no other block overlaps it
    - **Validates: Requirements 2.7, 6.2**
    - **Property 8: Minimum Session Length Enforcement** — verify every task block meets the task's minimum session length
    - **Validates: Requirements 3.4**
    - **Property 9: Task Splitting Preserves Total Duration** — verify sum of block durations for a split task equals remaining duration
    - **Validates: Requirements 3.5**
    - **Property 12: Urgency-Based Scheduling Priority** — verify higher-urgency assignments get blocks before lower-urgency ones
    - **Validates: Requirements 4.4**
    - **Property 13: No Assignment Block After Deadline** — verify no assignment block ends after its deadline
    - **Validates: Requirements 4.5**
    - **Property 15: Travel Buffer Enforcement** — verify adjacent blocks at different locations have sufficient travel buffer
    - **Validates: Requirements 5.3, 5.4, 5.5**
    - **Property 16: Schedule Blocks Are Chronologically Ordered** — verify blocks are ordered by start time
    - **Validates: Requirements 6.1**
    - **Property 17: No Block in Sleep Window** — verify no block overlaps the sleep window
    - **Validates: Requirements 6.4**
    - **Property 18: Minimum Block Duration Enforcement** — verify non-travel blocks meet minimum buffer minutes
    - **Validates: Requirements 6.5**
    - **Property 19: Overloaded Schedule Reports Unscheduled Items** — verify all unschedulable items are reported and priority ordering is respected
    - **Validates: Requirements 6.6**
    - **Property 20: Every Block Has an Explanation** — verify every block has a corresponding explanation
    - **Validates: Requirements 6.7, 9.1**
    - **Property 14: At-Risk Assignment Shortfall Reporting** — verify at-risk assignments are reported with correct shortfall
    - **Validates: Requirements 4.7**
    - **Property 25: Explanation Quality** — verify explanations reference specific constraint names
    - **Validates: Requirements 9.3, 9.5**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 7. Recurrence engine and schedule repair
  - [x] 7.1 Implement recurrence instance generation
    - Create `src/engine/recurrence.ts` with a function that expands a `FixedEvent` with a recurrence rule into concrete instances within a planning horizon
    - Support weekly recurrence patterns (e.g., every Monday/Wednesday/Friday)
    - Ensure generated instances match the recurrence pattern and fall within the horizon
    - _Requirements: 2.4_

  - [x] 7.2 Write property tests for recurrence
    - **Property 4: Recurrence Instance Generation** — generate random recurrence rules and horizons, verify all instances match the pattern and fall within boundaries
    - **Validates: Requirements 2.4**
    - **Property 5: Recurrence Instance Edit Isolation** — generate a recurring event, edit one instance, verify all other instances remain unchanged
    - **Validates: Requirements 2.5**

  - [x] 7.3 Implement schedule repair engine
    - Create `src/engine/repair.ts` implementing `SchedulingEngine.repair()`
    - Preserve all locked blocks in their exact positions
    - Attempt gap-first insertion for new items before displacing unlocked blocks
    - Minimize the number of blocks that change position
    - Reallocate missed/incomplete task remaining duration into available windows
    - Generate a `ChangeSummary` with moved, added, and removed block lists
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 7.4 Write property tests for schedule repair
    - **Property 21: Locked Blocks Are Immovable** — verify locked blocks remain at exact original positions after repair
    - **Validates: Requirements 6.8, 7.3, 11.3**
    - **Property 22: Missed Task Reallocation** — verify missed tasks with remaining duration get reallocated
    - **Validates: Requirements 7.2**
    - **Property 23: Gap-First Insertion During Repair** — verify new items are inserted into gaps without displacing unlocked blocks when gaps are sufficient
    - **Validates: Requirements 7.5**
    - **Property 24: Repair Change Summary Accuracy** — verify the change summary exactly matches actual differences between old and new plans
    - **Validates: Requirements 7.6**

- [x] 8. Service layer
  - [x] 8.1 Implement UserService and PreferenceProfile management
    - Create `src/services/user.ts` with `createUser`, `getUser`, `updatePreferences`
    - Validate preference inputs using validation module
    - Store times in user's configured timezone
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [x] 8.2 Implement EventService for fixed event CRUD
    - Create `src/services/event.ts` with `createFixedEvent`, `updateFixedEvent`, `updateRecurrenceInstance`, `deleteFixedEvent`, `getFixedEventsForDate`, `checkConflicts`
    - Validate time ranges, check for overlapping events and return conflict warnings
    - On delete, remove associated schedule blocks from future plans
    - Expand recurring events using the recurrence engine
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 8.3 Implement TaskService and AssignmentService
    - Create `src/services/task.ts` with `createFlexibleTask`, `updateFlexibleTask`, `deleteFlexibleTask`, `getUnscheduledTasks`
    - Create `src/services/assignment.ts` with `createAssignment`, `updateProgress`, `getAssignmentsWithUrgency`, `getAtRiskAssignments`
    - Validate all inputs; reject past due dates, zero durations, invalid session lengths
    - Recalculate urgency scores on progress updates
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 4.1, 4.6, 4.7_

  - [x] 8.4 Implement LocationService and TravelRule management
    - Create `src/services/location.ts` with `createLocation`, `createTravelRule`, `updateTravelRule`, `getTravelRules`
    - Validate travel rule inputs (positive travel minutes, valid location references)
    - _Requirements: 5.1, 5.2, 5.6_

  - [x] 8.5 Implement ScheduleService
    - Create `src/services/schedule.ts` with `generateSchedule`, `repairSchedule`, `lockBlock`, `unlockBlock`, `getSchedulePlan`, `getWeekPlan`, `getExplanation`
    - Orchestrate: fetch all inputs from repositories, invoke engine `solve()` or `repair()`, persist results in a transaction
    - On regeneration, preserve locked blocks; on repair, require user confirmation unless auto-repair is enabled
    - _Requirements: 6.1, 6.2, 6.8, 7.1, 7.7, 11.1, 11.2, 11.3, 9.2_

  - [x] 8.6 Write unit tests for service layer
    - Test CRUD operations store all required fields
    - Test conflict detection returns warnings for overlapping fixed events
    - Test preference updates propagate to subsequent schedule generation
    - Test lock/unlock state toggle and persistence
    - Test repair confirmation gating (changes not applied without confirmation unless auto-repair enabled)
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 3.1, 4.1, 5.1, 5.2, 7.7, 11.1, 11.2_


- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. API layer
  - [x] 10.1 Implement authentication middleware and error handling middleware
    - Create `src/middleware/auth.ts` — reject unauthenticated requests with HTTP 401
    - Create `src/middleware/error.ts` — catch errors and return structured JSON error responses with appropriate HTTP status codes (400, 401, 404, 500)
    - _Requirements: 13.6, 13.7, 13.8_

  - [x] 10.2 Implement CRUD API routes for all entities
    - Create Express routers in `src/routes/` for: users, preferences, fixed-events, flexible-tasks, assignments, locations, travel-rules
    - Wire request validation (return 400 with field-level errors for invalid input), delegate to services, return JSON responses
    - Implement all 28 endpoints as defined in the design's API endpoint table
    - _Requirements: 13.1, 13.6, 13.7_

  - [x] 10.3 Implement schedule generation and repair API routes
    - `POST /api/schedules/generate` — trigger schedule generation for a date
    - `POST /api/schedules/:id/repair` — trigger repair on existing plan
    - `GET /api/schedules?date=` — get schedule plan for date
    - `GET /api/schedules/week?start=` — get week plan
    - `PUT /api/schedule-blocks/:id/lock` and `PUT /api/schedule-blocks/:id/unlock`
    - `GET /api/schedule-blocks/:id/explanation` — get block explanation
    - _Requirements: 13.2, 13.3, 13.5_

  - [x] 10.4 Write property tests for API input validation
    - **Property 27: Invalid API Input Returns 400** — generate payloads with missing required fields or incorrect types for each endpoint, verify HTTP 400 with descriptive error messages
    - **Validates: Requirements 13.6**

  - [x] 10.5 Write integration tests for API endpoints
    - Test all CRUD endpoints respond correctly to valid requests
    - Test 404 for missing resources, 401 for unauthenticated requests
    - Test schedule generation and repair endpoints end-to-end with a test database
    - Test event deletion cascades to schedule blocks
    - Test preference and priority propagation through schedule generation
    - _Requirements: 13.1, 13.2, 13.3, 13.7, 13.8, 12.4, 12.5_

  - [x] 10.6 Write property test for fixed event overlap detection
    - **Property 3: Fixed Event Overlap Detection** — generate pairs of fixed events on the same date, verify overlap detection returns conflict iff time ranges overlap
    - **Validates: Requirements 2.3**

- [x] 11. AI assistant service
  - [x] 11.1 Implement AI assistant service
    - Create `src/services/ai-assistant.ts` implementing `AIAssistantService.processMessage()`
    - Build system prompt with user's current schedule context, available operations, timezone, and current time
    - Send user message to LLM (OpenAI API), parse structured JSON response into `AIResponse`
    - Handle intents: create, edit, delete, reschedule, explain, unknown
    - Convert relative date/time references ("tomorrow", "next Monday", "after work") to absolute values using user's timezone
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.8_

  - [x] 11.2 Implement AI assistant confirmation flow and error handling
    - Before applying any modification, return `confirmationRequired: true` with a summary of proposed changes
    - When intent is `explain`, retrieve the block's explanation and rephrase into conversational language
    - If required fields are missing from extracted intent, generate a targeted follow-up question
    - If message doesn't match any operation, respond with supported operations list
    - Handle LLM timeout/failure with user-friendly 503 message; handle unparseable responses by asking user to rephrase
    - _Requirements: 8.5, 8.6, 8.7, 9.2, 9.4_

  - [x] 11.3 Implement AI assistant API route
    - `POST /api/ai/message` — accept user message, delegate to AI assistant service, return `AIResponse`
    - _Requirements: 13.4_

  - [x] 11.4 Write unit tests for AI assistant
    - Test intent extraction for each operation type with mock LLM responses
    - Test follow-up question generation for missing fields
    - Test confirmation flow returns proposed changes without applying them
    - Test unsupported operation handling
    - Test error handling for LLM timeout and unparseable responses
    - _Requirements: 8.1, 8.5, 8.6, 8.7_

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 13. Frontend — layout, API client, and shared components
  - [x] 13.1 Set up Next.js app layout and navigation
    - Create root layout (`src/app/layout.tsx`) with sidebar navigation linking to Today, Week, Tasks, and Settings views
    - Set up calm, minimal design tokens in `src/styles/globals.css`
    - Create `src/lib/types.ts` with shared TypeScript types mirroring backend domain types
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 13.2 Implement API client layer
    - Create `src/lib/api.ts` with typed functions for all backend endpoints (users, events, tasks, assignments, locations, travel rules, schedules, AI messages)
    - Create `src/lib/utils.ts` with date/time formatting utilities
    - _Requirements: 13.1_

  - [x] 13.3 Implement ScheduleBlock component with category colors and lock indicator
    - Create `src/components/calendar/ScheduleBlock.tsx` — render block card with start/end time, title, category color coding, source type indicator, and lock icon for locked blocks
    - Create `src/components/calendar/FreeTimeSlot.tsx` — render empty gap indicator
    - Visually distinguish Fixed_Events, Flexible_Task blocks, Assignment blocks, and travel buffers using distinct colors
    - _Requirements: 10.6, 11.4_

- [x] 14. Frontend — Today view and Week view
  - [x] 14.1 Implement Today view
    - Create `src/app/page.tsx` (Today view) displaying all schedule blocks for the current date in chronological order
    - Show start time, end time, title, category, and source type for each block
    - Create `src/hooks/useSchedule.ts` for schedule data fetching and mutations
    - _Requirements: 10.1, 10.5_

  - [x] 14.2 Implement Week view
    - Create `src/app/week/page.tsx` displaying schedule blocks for 7 consecutive days
    - Show fixed events, allocated task blocks, assignment blocks, and free time windows in a grid layout
    - _Requirements: 10.2_

  - [x] 14.3 Implement block detail panel with explanation display
    - Create `src/components/calendar/BlockDetail.tsx` — on block click, show detail panel with full block info and explanation text
    - Fetch explanation from `GET /api/schedule-blocks/:id/explanation`
    - Include lock/unlock toggle button that calls the lock/unlock API
    - _Requirements: 10.4, 9.2, 11.1, 11.2_

- [x] 15. Frontend — Task/Assignment views and forms
  - [x] 15.1 Implement Task/Assignment list view
    - Create `src/app/tasks/page.tsx` displaying unscheduled flexible tasks and assignments
    - Show priority, due date, urgency score, estimated remaining duration, and progress percentage
    - _Requirements: 10.3_

  - [x] 15.2 Implement entity creation/edit forms
    - Create `src/components/events/EventForm.tsx` for fixed event create/edit with recurrence selector (`RecurrenceSelector.tsx`)
    - Create `src/components/tasks/TaskForm.tsx` for flexible task and assignment create/edit
    - Wire forms to API client; display validation errors from 400 responses
    - _Requirements: 2.1, 3.1, 4.1_

  - [x] 15.3 Implement Settings page with preference profile and location management
    - Create `src/app/settings/page.tsx` with `PreferenceForm.tsx` for editing wake time, sleep time, focus windows, workout windows, buffer minutes, max deep work, default commute, auto-repair toggle
    - Create `LocationManager.tsx` for managing locations and travel rules
    - _Requirements: 1.2, 1.3, 5.1, 5.2_

- [x] 16. Frontend — AI chat panel
  - [x] 16.1 Implement AI chat interface
    - Create `src/components/chat/ChatPanel.tsx` as a persistent side panel with message input and message history
    - Create `src/components/chat/MessageBubble.tsx` for rendering user and assistant messages
    - Create `src/components/chat/ConfirmationCard.tsx` for displaying proposed schedule changes with confirm/reject buttons
    - Create `src/hooks/useChat.ts` for AI chat state management
    - Wire to `POST /api/ai/message` endpoint
    - _Requirements: 8.1, 8.5, 8.6, 8.7_

  - [x] 16.2 Write unit tests for frontend components
    - Test Today view renders blocks in chronological order
    - Test Week view renders 7 days of blocks
    - Test block detail panel shows explanation text
    - Test lock indicator visibility for locked/unlocked blocks
    - Test category color coding for different source types
    - Test confirmation card renders proposed changes
    - _Requirements: 10.1, 10.2, 10.4, 10.6, 11.4_

- [x] 17. Final integration and wiring
  - [x] 17.1 Wire frontend schedule generation and repair flows
    - Add "Generate Plan" button on Today view that calls `POST /api/schedules/generate`
    - Add repair flow: when events change, prompt user to repair or auto-repair based on preference
    - Ensure Today and Week views refresh within 2 seconds of schedule generation/repair completing
    - Display unscheduled items and at-risk assignment warnings after generation
    - _Requirements: 6.1, 6.6, 4.7, 7.7, 10.5_

  - [x] 17.2 Wire conflict warnings and validation error display
    - When creating a fixed event that overlaps another, display conflict warning before saving
    - Display all validation errors from API 400 responses inline on forms
    - Display repair change summary (moved, added, removed blocks) after repair completes
    - _Requirements: 2.3, 7.6, 13.6_

  - [x] 17.3 Write integration tests for end-to-end flows
    - Test full schedule generation flow: create user, preferences, events, tasks, assignments → generate plan → verify blocks respect all constraints
    - Test repair flow: generate plan → add new event → repair → verify locked blocks preserved and change summary accurate
    - Test AI assistant flow with mock LLM: send message → verify intent extraction → verify confirmation → verify schedule update
    - _Requirements: 6.1, 6.2, 7.1, 7.3, 7.6, 8.1_

- [x] 18. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate the 27 universal correctness properties from the design document
- Unit and integration tests cover specific scenarios, edge cases, and end-to-end flows
- The scheduling engine is built as a pure function before services, enabling thorough isolated testing
- Frontend tasks come after the full backend is wired, ensuring API contracts are stable
