# Requirements Document

## Introduction

Cog (Chill Out Gang) is an AI-assisted personal life scheduler and daily planning system. Cog generates realistic daily and weekly schedules by combining fixed commitments (classes, work shifts, appointments), flexible tasks (study sessions, workouts, errands), assignment deadlines, and travel constraints into a single optimized plan. The system uses constraint-based scheduling logic for dependable output and an AI assistant layer for conversational input, editing, and schedule explanations. The primary target user is a university student or young professional balancing recurring commitments, changing shifts, deadlines, and personal routines.

## Glossary

- **Scheduler**: The constraint-based scheduling engine that generates and repairs daily plans by placing schedule blocks into available time windows while respecting hard constraints and optimizing for soft preferences.
- **AI_Assistant**: The natural language processing layer that converts conversational user input into structured schedule operations and generates human-readable explanations of scheduling decisions.
- **Fixed_Event**: A calendar commitment with a defined start time, end time, and date that acts as a hard constraint and cannot be moved or overlapped by the Scheduler.
- **Flexible_Task**: A task with an estimated duration, priority, and optional due date that the Scheduler may place into any available time window and may split across multiple blocks.
- **Assignment**: A piece of work with a deadline, estimated total hours, and progress tracking that the Scheduler allocates time for before the due date with increasing urgency as the deadline approaches.
- **Schedule_Plan**: The generated output for a single day containing an ordered sequence of Schedule_Blocks.
- **Schedule_Block**: A single time slot within a Schedule_Plan representing either a Fixed_Event, an allocated Flexible_Task session, an Assignment work session, or a travel/buffer period.
- **Hard_Constraint**: A scheduling rule that must never be violated, including fixed event times, required travel time, minimum sleep windows, deadline latest finish times, and locked blocks.
- **Soft_Constraint**: A scheduling preference that the Scheduler optimizes for when possible, including preferred study periods, workout windows, task grouping, and buffer preferences.
- **Travel_Rule**: A defined estimated travel time in minutes between two Locations that the Scheduler must account for when placing adjacent commitments at different locations.
- **Location**: A named place (such as home, university, workplace, or gym) used by Travel_Rules to calculate required transit time between commitments.
- **Preference_Profile**: A collection of user-defined default planning preferences including wake time, sleep target, focus windows, workout windows, and buffer settings.
- **Locked_Block**: A Schedule_Block that the user has explicitly locked, preventing the Scheduler from moving or removing it during plan generation or repair.
- **Explanation**: A human-readable text describing why the Scheduler placed a specific Schedule_Block at its assigned time, referencing the constraints and preferences that influenced the decision.
- **Schedule_Repair**: The process of updating an existing Schedule_Plan with minimal disruption when a commitment changes, a task is missed, or new work is added, while preserving Locked_Blocks and user-approved blocks.
- **Constraint_Rule**: A configurable rule stored in the system that defines either a Hard_Constraint or Soft_Constraint with its type, strength, and configuration parameters.
- **Urgency_Score**: A computed value for an Assignment that increases as the deadline approaches relative to remaining estimated work, used by the Scheduler to prioritize time allocation.

## Requirements

### Requirement 1: User Account and Preference Profile Creation

**User Story:** As a user, I want to create a profile with my default planning preferences, so that the Scheduler can generate plans tailored to my lifestyle without requiring me to configure every detail each time.

#### Acceptance Criteria

1. WHEN a new user registers, THE System SHALL create a User record containing id, name, timezone, and onboarding status.
2. WHEN a user completes onboarding, THE System SHALL create a Preference_Profile containing wake time, sleep time, preferred focus windows, preferred workout windows, minimum buffer minutes, and maximum deep work block minutes.
3. WHEN a user updates any field in the Preference_Profile, THE System SHALL persist the change and apply the updated preferences to all subsequent schedule generation requests.
4. THE System SHALL validate that wake time is earlier than sleep time within the same logical day (accounting for overnight sleep).
5. IF a user submits a Preference_Profile with minimum buffer minutes less than zero, THEN THE System SHALL reject the input and return a descriptive validation error.
6. THE System SHALL store all times in the user's configured timezone.

### Requirement 2: Fixed Commitment Management

**User Story:** As a user, I want to enter my classes, work shifts, and appointments as fixed commitments, so that the Scheduler treats them as immovable anchors in my plan.

#### Acceptance Criteria

1. WHEN a user creates a Fixed_Event, THE System SHALL store the title, date, start time, end time, location, recurrence rule, category, and optional notes.
2. THE System SHALL validate that the end time of a Fixed_Event is after the start time of the same Fixed_Event.
3. IF a user creates a Fixed_Event that overlaps in time with an existing Fixed_Event on the same date, THEN THE System SHALL warn the user about the conflict before saving.
4. WHEN a user marks a Fixed_Event as recurring, THE System SHALL generate instances of the Fixed_Event according to the specified recurrence rule for the planning horizon.
5. WHEN a user edits a single instance of a recurring Fixed_Event, THE System SHALL apply the change only to that instance and preserve all other instances.
6. WHEN a user deletes a Fixed_Event, THE System SHALL remove the Fixed_Event and all associated Schedule_Blocks from future Schedule_Plans.
7. THE Scheduler SHALL treat every Fixed_Event as a Hard_Constraint and never place any other Schedule_Block overlapping a Fixed_Event time window.

### Requirement 3: Flexible Task Management

**User Story:** As a user, I want to create flexible tasks with estimated durations and priorities, so that the Scheduler can find the best available time slots for them around my fixed commitments.

#### Acceptance Criteria

1. WHEN a user creates a Flexible_Task, THE System SHALL store the title, category, estimated duration in minutes, minimum session length in minutes, priority level, due date, energy requirement, and preferred completion window.
2. THE System SHALL validate that the estimated duration of a Flexible_Task is greater than zero.
3. THE System SHALL validate that the minimum session length of a Flexible_Task does not exceed the estimated duration of the same Flexible_Task.
4. WHEN a Flexible_Task has a minimum session length defined, THE Scheduler SHALL not create any Schedule_Block for that Flexible_Task shorter than the specified minimum session length.
5. WHEN a Flexible_Task has remaining duration greater than the minimum session length, THE Scheduler SHALL split the Flexible_Task across multiple Schedule_Blocks if no single available window can accommodate the full estimated duration.
6. WHEN a user updates the priority of a Flexible_Task, THE System SHALL use the updated priority in the next schedule generation or repair operation.
7. IF a user creates a Flexible_Task with a due date in the past, THEN THE System SHALL reject the input and return a descriptive validation error.

### Requirement 4: Assignment and Deadline Tracking

**User Story:** As a user, I want to track my assignments with deadlines and estimated hours, so that the Scheduler allocates study time before due dates and increases urgency as deadlines approach.

#### Acceptance Criteria

1. WHEN a user creates an Assignment, THE System SHALL store the title, subject, deadline date and time, estimated total minutes, current progress percentage, and computed Urgency_Score.
2. THE System SHALL compute the Urgency_Score of an Assignment based on the ratio of remaining estimated work to remaining time before the deadline.
3. WHEN the remaining time before an Assignment deadline decreases, THE System SHALL increase the Urgency_Score of that Assignment proportionally.
4. WHEN generating a Schedule_Plan, THE Scheduler SHALL allocate time blocks for Assignments with higher Urgency_Scores before allocating time for Assignments with lower Urgency_Scores.
5. THE Scheduler SHALL not place any Assignment work block after the deadline of that Assignment.
6. WHEN a user updates the progress percentage of an Assignment, THE System SHALL recalculate the remaining estimated work and update the Urgency_Score accordingly.
7. IF an Assignment cannot be fully scheduled before the deadline given the available time windows, THEN THE System SHALL notify the user that the Assignment is at risk of not being completed on time and display the shortfall in minutes.

### Requirement 5: Location and Travel-Aware Scheduling

**User Story:** As a user, I want to define my common locations and travel times between them, so that the Scheduler adds realistic commute time and prevents physically impossible transitions.

#### Acceptance Criteria

1. WHEN a user creates a Location, THE System SHALL store the location id, name, label, and type.
2. WHEN a user creates a Travel_Rule, THE System SHALL store the origin location id, destination location id, and estimated travel time in minutes.
3. WHEN the Scheduler places two adjacent Schedule_Blocks at different Locations, THE Scheduler SHALL insert a travel buffer between the two blocks equal to or greater than the estimated travel time defined by the applicable Travel_Rule.
4. IF no Travel_Rule exists between two Locations, THEN THE Scheduler SHALL use the default commute time from the user's Preference_Profile as the travel buffer.
5. THE Scheduler SHALL not place a Schedule_Block at a Location if the travel time from the preceding block's Location would cause the new block to start after its required start time.
6. WHEN a user updates the estimated travel time in a Travel_Rule, THE System SHALL apply the updated travel time to all subsequent schedule generation and repair operations.

### Requirement 6: Schedule Generation

**User Story:** As a user, I want to generate a full daily plan with one action, so that I get a realistic schedule that respects all my commitments, deadlines, travel, and preferences without manual arrangement.

#### Acceptance Criteria

1. WHEN a user requests schedule generation for a specific date, THE Scheduler SHALL create a Schedule_Plan containing an ordered sequence of Schedule_Blocks for that date.
2. THE Scheduler SHALL place all Fixed_Events into the Schedule_Plan first, before placing any Flexible_Tasks or Assignment blocks.
3. THE Scheduler SHALL respect the following optimization order: (1) Hard_Constraint feasibility, (2) deadline safety and urgency, (3) travel feasibility and transition buffers, (4) user wellbeing constraints including sleep and workload balance, (5) preference matching including gym timing and preferred focus hours, (6) convenience including fewer disruptions and less fragmentation.
4. THE Scheduler SHALL not place any Schedule_Block within the user's minimum sleep window as defined in the Preference_Profile.
5. THE Scheduler SHALL not create any Schedule_Block shorter than the minimum buffer minutes defined in the user's Preference_Profile, except for travel buffer blocks.
6. WHEN the Scheduler cannot place all Flexible_Tasks and Assignments into available windows for a given date, THE Scheduler SHALL place as many items as possible in priority order and report the unscheduled items to the user.
7. THE Scheduler SHALL generate an Explanation for each generated Schedule_Block describing why the block was placed at its assigned time, referencing the constraints and preferences that influenced the decision.
8. WHEN a user requests schedule generation for a date that already has a Schedule_Plan, THE Scheduler SHALL regenerate the plan while preserving all Locked_Blocks in their current positions.

### Requirement 7: Schedule Repair and Rescheduling

**User Story:** As a user, I want the app to repair my plan when something changes instead of making me rebuild the day manually, so that disruptions are handled with minimal stress.

#### Acceptance Criteria

1. WHEN a Fixed_Event is added, modified, or removed from a date that has an existing Schedule_Plan, THE Scheduler SHALL perform a Schedule_Repair on the affected Schedule_Plan.
2. WHEN a Flexible_Task is marked as missed or incomplete, THE Scheduler SHALL reallocate the remaining duration of that Flexible_Task into available windows in the current or subsequent Schedule_Plans.
3. DURING Schedule_Repair, THE Scheduler SHALL not move or remove any Locked_Block from its current position.
4. DURING Schedule_Repair, THE Scheduler SHALL minimize the number of Schedule_Blocks that change position compared to the previous version of the Schedule_Plan.
5. WHEN a new Flexible_Task or Assignment is added to a date with an existing Schedule_Plan, THE Scheduler SHALL attempt to insert the new item into available gaps without displacing existing unlocked blocks, and displace unlocked blocks only if no gap is sufficient.
6. AFTER completing a Schedule_Repair, THE System SHALL present the user with a summary of changes made, including which blocks moved, which blocks were added, and which blocks were removed.
7. THE System SHALL not apply Schedule_Repair changes to the Schedule_Plan until the user confirms or the user has enabled automatic repair in the Preference_Profile.

### Requirement 8: AI Assistant for Conversational Interaction

**User Story:** As a user, I want to type natural language commands like "move gym to tomorrow because I finish work late" and have the app update my schedule, so that managing my plan feels effortless and conversational.

#### Acceptance Criteria

1. WHEN a user submits a natural language message, THE AI_Assistant SHALL parse the message and identify the intended operation (create, edit, delete, reschedule, or explain).
2. WHEN the AI_Assistant identifies a create operation, THE AI_Assistant SHALL extract structured fields (title, date, time, duration, category, priority) from the natural language input and create the corresponding Fixed_Event, Flexible_Task, or Assignment.
3. WHEN the AI_Assistant identifies a reschedule operation, THE AI_Assistant SHALL determine the target item and the requested change, then invoke the Scheduler to perform the update.
4. WHEN the AI_Assistant identifies an explain operation, THE AI_Assistant SHALL retrieve the Explanation for the referenced Schedule_Block and present the explanation in plain language.
5. IF the AI_Assistant cannot determine all required fields from the user's message, THEN THE AI_Assistant SHALL ask the user a specific follow-up question for only the missing fields.
6. BEFORE applying any schedule modification, THE AI_Assistant SHALL present a summary of the proposed changes to the user and wait for confirmation.
7. WHEN the AI_Assistant receives a message that does not correspond to any supported operation, THE AI_Assistant SHALL respond with a helpful message listing the supported operations.
8. THE AI_Assistant SHALL convert all date and time references in user messages (such as "tomorrow", "next Monday", "after work") to absolute date and time values using the user's configured timezone.

### Requirement 9: AI-Generated Schedule Explanations

**User Story:** As a user, I want the app to explain why it chose a specific schedule arrangement, so that I can trust the plan and understand the reasoning behind each decision.

#### Acceptance Criteria

1. THE Scheduler SHALL generate an Explanation record for every Schedule_Block created during schedule generation or repair.
2. WHEN a user requests an explanation for a specific Schedule_Block, THE System SHALL display the Explanation text describing the constraints and preferences that determined the block's placement.
3. THE Explanation text SHALL reference specific constraint names (such as "Fixed_Event conflict", "Travel_Rule between Home and University", or "Assignment deadline proximity") rather than generic descriptions.
4. WHEN the AI_Assistant presents an Explanation to the user, THE AI_Assistant SHALL rephrase the Explanation into conversational plain language while preserving the factual content.
5. IF a Schedule_Block was placed in a suboptimal time due to constraint conflicts, THEN THE Explanation SHALL describe which constraints prevented optimal placement and what tradeoffs were made.

### Requirement 10: Calendar Views

**User Story:** As a user, I want to see my plan in a Today view and a Week view, so that I can quickly understand what is happening now and what is coming up.

#### Acceptance Criteria

1. THE System SHALL provide a Today view displaying all Schedule_Blocks for the current date in chronological order, including start time, end time, title, category, and source type (Fixed_Event, Flexible_Task, Assignment, or travel buffer).
2. THE System SHALL provide a Week view displaying all Schedule_Blocks for seven consecutive days, showing Fixed_Events, allocated Flexible_Task blocks, Assignment blocks, and free time windows.
3. THE System SHALL provide a Task/Assignment view displaying all unscheduled Flexible_Tasks and Assignments with their priority, due date, Urgency_Score, estimated remaining duration, and progress percentage.
4. WHEN a user taps or clicks a Schedule_Block in the Today view or Week view, THE System SHALL display the detail panel for that block including the Explanation text.
5. WHEN a Schedule_Plan is generated or repaired, THE System SHALL update the Today view and Week view within 2 seconds of the operation completing.
6. THE System SHALL visually distinguish between Fixed_Events, Flexible_Task blocks, Assignment blocks, travel buffers, and free time using distinct colors or visual indicators.

### Requirement 11: Schedule Block Locking

**User Story:** As a user, I want to lock specific schedule blocks so the optimizer does not move them, so that I maintain control over parts of my plan that I have already committed to.

#### Acceptance Criteria

1. WHEN a user locks a Schedule_Block, THE System SHALL set the locked status of that Schedule_Block to true and persist the change.
2. WHEN a user unlocks a Schedule_Block, THE System SHALL set the locked status of that Schedule_Block to false and persist the change.
3. THE Scheduler SHALL treat every Locked_Block as a Hard_Constraint during schedule generation and Schedule_Repair.
4. THE System SHALL visually indicate the locked status of each Schedule_Block in the Today view and Week view using a distinct visual marker.
5. WHEN a user attempts to lock a Schedule_Block that conflicts with an existing Hard_Constraint, THE System SHALL allow the lock and preserve the block in its current position.

### Requirement 12: Data Persistence and Serialization

**User Story:** As a developer, I want all schedule data to be reliably persisted and serializable, so that the system can store, retrieve, and transmit schedule information without data loss.

#### Acceptance Criteria

1. THE System SHALL serialize all Schedule_Plan data to JSON format for API transmission.
2. THE System SHALL deserialize JSON schedule data back into Schedule_Plan objects without data loss.
3. FOR ALL valid Schedule_Plan objects, serializing to JSON then deserializing back to a Schedule_Plan object SHALL produce an object equivalent to the original (round-trip property).
4. THE System SHALL persist all User, Preference_Profile, Location, Travel_Rule, Fixed_Event, Flexible_Task, Assignment, Schedule_Plan, Schedule_Block, Constraint_Rule, and Explanation records to a PostgreSQL database.
5. IF a database write operation fails, THEN THE System SHALL return a descriptive error to the caller and not leave partially written data in an inconsistent state.

### Requirement 13: API Design

**User Story:** As a developer, I want well-defined API endpoints for all schedule operations, so that the frontend and AI_Assistant can interact with the backend through a consistent interface.

#### Acceptance Criteria

1. THE System SHALL expose RESTful API endpoints for creating, reading, updating, and deleting User, Preference_Profile, Location, Travel_Rule, Fixed_Event, Flexible_Task, and Assignment resources.
2. THE System SHALL expose an API endpoint for triggering schedule generation for a specified date.
3. THE System SHALL expose an API endpoint for triggering Schedule_Repair on an existing Schedule_Plan.
4. THE System SHALL expose an API endpoint for submitting natural language messages to the AI_Assistant and receiving structured responses.
5. THE System SHALL expose an API endpoint for retrieving the Explanation for a specific Schedule_Block.
6. WHEN an API request contains invalid or missing required fields, THE System SHALL return an HTTP 400 response with a descriptive error message identifying the invalid fields.
7. WHEN an API request references a resource that does not exist, THE System SHALL return an HTTP 404 response with a descriptive error message.
8. THE System SHALL authenticate all API requests and reject unauthenticated requests with an HTTP 401 response.
