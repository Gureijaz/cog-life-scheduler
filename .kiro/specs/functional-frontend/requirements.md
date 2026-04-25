# Requirements Document

## Introduction

This specification covers making the Cog Life Scheduler frontend fully functional by wiring existing UI components to the backend API. The frontend has been redesigned with a polished UI (design tokens, dark mode, animations, responsive layout) but is missing the actual CRUD flows, interactive features, and data connectivity. The backend API is fully built with all endpoints operational. The frontend API client (`api.ts`) has all typed functions ready, and hooks (`useSchedule`, `useChat`, `useToast`) are built. The existing form components (`EventForm`, `TaskForm`, `PreferenceForm`) exist but are not accessible from the main views.

This spec covers seven areas: item creation via modal forms, item editing and deletion, schedule generation flow completion, AI chatbot wiring, schedule block interactions, settings persistence, and data refresh after mutations.

## Glossary

- **Modal**: A lightweight overlay component that wraps form components (EventForm, TaskForm) in a centered card with a backdrop, providing a consistent pattern for creating and editing items from any page.
- **Create_Flow**: The user interaction sequence of clicking a "+" button, filling a form in a Modal, submitting to the API, receiving confirmation via toast, and seeing the page data refresh.
- **Edit_Flow**: The user interaction sequence of clicking an edit button on an item card, opening a pre-filled form in a Modal, submitting changes to the API, and seeing the updated data.
- **Delete_Flow**: The user interaction sequence of clicking a delete button on an item card, confirming the deletion in a confirmation dialog, calling the delete API, and seeing the item removed from the list.
- **Schedule_Generation_Flow**: The end-to-end flow triggered by the "Generate Plan" button: calling the API, showing loading state, rendering generated blocks, and displaying unscheduled/at-risk warnings.
- **AI_Chat_Flow**: The interaction flow in the ChatPanel: sending a message to POST /api/ai/message, handling response intents (create, edit, delete, reschedule, explain, unknown), showing ConfirmationCards for actions requiring confirmation, and gracefully handling AI unavailability.
- **Data_Refresh**: The pattern of re-fetching page data after any successful mutation (create, edit, delete) to ensure the UI reflects the latest server state.
- **Graceful_Degradation**: The behavior of showing a user-friendly error message when a dependent service (e.g., AI/OpenAI) is unavailable, rather than crashing or showing a raw error.

## Requirements

### Requirement 1: Modal Component for Form Overlays

**User Story:** As a user, I want forms to appear in a clean overlay when I click create or edit buttons, so that I can add or modify items without leaving my current view.

#### Acceptance Criteria

1. THE Modal component SHALL render a semi-transparent backdrop overlay covering the full viewport when the `open` prop is true.
2. THE Modal component SHALL render the children content in a centered card with consistent padding and border radius matching the design system.
3. WHEN a user clicks the backdrop area outside the modal content, THE Modal SHALL close by calling the `onClose` callback.
4. WHEN a user presses the Escape key while a Modal is open, THE Modal SHALL close by calling the `onClose` callback.
5. WHEN a Modal opens, THE Modal SHALL move focus to the first focusable element within the modal content.
6. THE Modal SHALL use a fade-in and slide-up CSS animation on open, completing within 200 milliseconds.

### Requirement 2: Item Creation from Main Views

**User Story:** As a user, I want "+" buttons on the Today, Week, and Tasks pages to create new events, tasks, and assignments, so that I can quickly add items without navigating away.

#### Acceptance Criteria

1. THE Today page SHALL display a "+" button or "Add Event" and "Add Task" buttons in the header area next to the "Generate Plan" button.
2. WHEN a user clicks the add event button on the Today page, THE system SHALL open a Modal containing the EventForm component with empty initial values.
3. WHEN a user clicks the add task button on the Today page, THE system SHALL open a Modal containing the TaskForm component with empty initial values.
4. THE Week page SHALL display an "Add Event" button in the header area.
5. WHEN a user clicks the add event button on the Week page, THE system SHALL open a Modal containing the EventForm component with empty initial values.
6. THE Tasks page SHALL display an "Add Task" button in the header area.
7. WHEN a user clicks the add task button on the Tasks page, THE system SHALL open a Modal containing the TaskForm component with empty initial values, supporting both task and assignment creation via the existing tab switcher.
8. WHEN a form submission succeeds inside a creation Modal, THE system SHALL close the Modal, display a success toast, and refresh the page's data.

### Requirement 3: Item Editing and Deletion

**User Story:** As a user, I want to edit and delete my tasks and assignments from the Tasks page, so that I can keep my task list accurate and up to date.

#### Acceptance Criteria

1. EACH task card on the Tasks page SHALL display an edit button and a delete button.
2. EACH assignment card on the Tasks page SHALL display an edit button and a delete button.
3. WHEN a user clicks the edit button on a task card, THE system SHALL open a Modal containing the TaskForm component pre-filled with the task's current data.
4. WHEN a user clicks the edit button on an assignment card, THE system SHALL open a Modal containing the TaskForm component in assignment mode, pre-filled with the assignment's current data.
5. WHEN a form submission succeeds inside an edit Modal, THE system SHALL close the Modal, display a success toast, and refresh the task list.
6. WHEN a user clicks the delete button on a task card, THE system SHALL display a confirmation dialog asking the user to confirm the deletion.
7. WHEN the user confirms the deletion, THE system SHALL call the delete API endpoint, display a success toast, and refresh the task list.
8. WHEN the user cancels the deletion, THE system SHALL close the confirmation dialog without calling the delete API.
9. IF a delete API call fails, THEN THE system SHALL display an error toast with the error message and leave the task list unchanged.

### Requirement 4: Schedule Generation Flow

**User Story:** As a user, I want the "Generate Plan" button to work end-to-end with proper loading feedback and result rendering, so that I can generate my daily schedule with confidence.

#### Acceptance Criteria

1. WHEN a user clicks the "Generate Plan" button, THE system SHALL disable the button and display a spinning loading indicator on the button.
2. THE system SHALL call POST /api/schedules/generate with the current date.
3. WHEN the API call succeeds, THE system SHALL render the generated schedule blocks with staggered entrance animations and display a success toast.
4. IF the API call fails, THEN THE system SHALL re-enable the button and display an error toast with the error message.
5. WHEN the API response includes unscheduled items, THE system SHALL display an amber-tinted warning section listing each unscheduled item's title and reason.
6. WHEN the API response includes at-risk assignments, THE system SHALL display a red-tinted warning section listing each at-risk assignment's title and shortfall duration.
7. WHEN a repair summary is available after a repair operation, THE system SHALL display the RepairSummary component showing moved, added, and removed blocks.

### Requirement 5: AI Chatbot Integration

**User Story:** As a user, I want the AI chat panel to be fully functional so I can create events, reschedule tasks, and get explanations through natural language, with graceful handling when the AI is unavailable.

#### Acceptance Criteria

1. WHEN a user sends a message in the ChatPanel, THE system SHALL call POST /api/ai/message with the message text and display a typing indicator while waiting for the response.
2. WHEN the AI response has intent "create", "edit", "delete", or "reschedule" with `confirmationRequired: true`, THE system SHALL display a ConfirmationCard below the assistant message with the action summary, a Confirm button, and a Cancel button.
3. WHEN the user clicks Confirm on a ConfirmationCard, THE system SHALL send a "confirm" message to the AI backend and display the execution result.
4. WHEN the user clicks Cancel on a ConfirmationCard, THE system SHALL display an "Action cancelled" message without calling the API.
5. WHEN the AI response has intent "explain", THE system SHALL display the explanation text in the assistant message bubble.
6. WHEN the AI response has intent "unknown", THE system SHALL display a helpful message listing supported operations.
7. WHEN the AI backend returns a 503 or 500 error, or a network error occurs, THE system SHALL display a friendly message indicating the AI assistant is unavailable and suggest checking the OPENAI_API_KEY configuration.
8. THE ChatPanel SHALL NOT crash or become unresponsive after an AI error, and the user SHALL be able to continue sending messages.
9. WHEN a confirmed AI action results in a data change (create, edit, delete), THE system SHALL trigger a data refresh on the relevant page views.

### Requirement 6: Schedule Block Interactions

**User Story:** As a user, I want to click schedule blocks to see details and toggle their lock status, so that I can understand and control my schedule.

#### Acceptance Criteria

1. WHEN a user clicks a schedule block in the Today view or Week view, THE system SHALL open the BlockDetail panel showing the block's title, time range, source type, lock status, and AI-generated explanation.
2. THE BlockDetail panel SHALL load the explanation from the API via GET /api/schedule-blocks/:id/explanation and display a loading skeleton while fetching.
3. WHEN a user clicks the lock/unlock toggle in the BlockDetail panel, THE system SHALL call the appropriate lock or unlock API endpoint and update the block's lock status in the UI.
4. IF the lock/unlock API call fails, THEN THE system SHALL revert the UI to the previous lock state and display an error toast.
5. THE Week view SHALL pass the onLockToggle handler to the BlockDetail panel, matching the Today view's behavior.

### Requirement 7: Settings Persistence

**User Story:** As a user, I want my preference changes and location additions to save to the backend with clear success/error feedback, so that I know my settings are persisted.

#### Acceptance Criteria

1. WHEN a user saves preferences in the PreferenceForm, THE system SHALL call PUT /api/users/:id/preferences and display a success toast on success.
2. IF the preference save fails with validation errors, THEN THE system SHALL display inline error messages below the invalid fields.
3. IF the preference save fails with a server error, THEN THE system SHALL display an error toast.
4. WHEN a user adds a location in the LocationManager, THE system SHALL call POST /api/locations and display a success toast on success.
5. WHEN a user adds a travel rule in the LocationManager, THE system SHALL call POST /api/travel-rules and display a success toast on success.
6. IF a location or travel rule creation fails, THEN THE system SHALL display an error toast with the error message.

### Requirement 8: Data Refresh After Mutations

**User Story:** As a user, I want the page to automatically show updated data after I create, edit, or delete items, so that I always see the current state without manually refreshing.

#### Acceptance Criteria

1. AFTER a successful event creation from the Today page, THE system SHALL re-fetch the schedule data for the current date.
2. AFTER a successful event creation from the Week page, THE system SHALL re-fetch the week schedule data.
3. AFTER a successful task or assignment creation, edit, or deletion from the Tasks page, THE system SHALL re-fetch the tasks and assignments lists.
4. AFTER a successful AI-confirmed action that modifies data, THE system SHALL trigger a data refresh on the currently visible page.
5. THE data refresh SHALL complete and update the UI within 2 seconds of the mutation succeeding.
