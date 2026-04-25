# Implementation Tasks

## Task 1: Create Modal Component

- [-] 1.1 Create `frontend/src/components/ui/Modal.tsx` with backdrop overlay, centered content card, fade-in/slide-up animation, backdrop click to close, Escape key to close, and focus management
- [~] 1.2 Add Modal CSS styles to `frontend/src/styles/globals.css` including `.modal-overlay`, `.modal-content`, animation keyframes, and responsive sizing
- [~] 1.3 Write unit tests for Modal component in `frontend/src/components/ui/Modal.test.tsx` covering open/close state, Escape key, and backdrop click

## Task 2: Wire Item Creation on Today Page

- [~] 2.1 Add "Add Event" and "Add Task" buttons to the Today page header next to "Generate Plan"
- [~] 2.2 Add modal state management (showEventModal, showTaskModal) to TodayPage
- [~] 2.3 Render EventForm and TaskForm inside Modal components with onSaved triggering modal close and `refresh()` from useSchedule
- [~] 2.4 Write tests for Today page creation flow in `frontend/src/app/page.test.tsx` verifying modal opens on button click and closes on save

## Task 3: Wire Item Creation on Week Page

- [~] 3.1 Add "Add Event" button to the Week page header
- [~] 3.2 Add modal state and render EventForm inside Modal with onSaved triggering modal close and `refresh()` from useWeekSchedule
- [~] 3.3 Pass `onLockToggle` handler to BlockDetail in Week page (currently missing)

## Task 4: Wire Item Creation, Editing, and Deletion on Tasks Page

- [~] 4.1 Add "Add Task" button to the Tasks page header
- [~] 4.2 Add modal state (showTaskModal, editingTask, editingAssignment) and render TaskForm inside Modal
- [~] 4.3 Add edit and delete action buttons to each task card and assignment card
- [~] 4.4 Implement edit flow: clicking edit opens TaskForm in Modal pre-filled with item data (initialTask or initialAssignment props)
- [~] 4.5 Implement delete flow with confirmation: clicking delete shows confirmation dialog, confirming calls `flexibleTasks.delete()` or appropriate API, refreshes list, shows toast
- [~] 4.6 Write tests for Tasks page CRUD flows in `frontend/src/app/tasks/page.test.tsx`

## Task 5: Complete AI Chatbot Integration

- [~] 5.1 Update `useChat` hook to handle AI unavailable errors (503/500) with a friendly "AI unavailable" message mentioning OPENAI_API_KEY
- [~] 5.2 Add `onDataChanged` callback prop to ChatPanel so parent layout can trigger page data refreshes after confirmed AI actions
- [~] 5.3 Wire `onDataChanged` in `layout.tsx` to propagate refresh signals to child pages
- [~] 5.4 Write tests for useChat hook error handling in `frontend/src/hooks/useChat.test.ts` covering 503 error graceful degradation

## Task 6: Wire Schedule Block Lock/Unlock with Error Handling

- [~] 6.1 Add error handling with toast and state rollback to the lock/unlock toggle in TodayPage's `handleLockToggle`
- [~] 6.2 Add `onLockToggle` handler with error handling to WeekPage's BlockDetail usage
- [~] 6.3 Write tests for lock toggle error rollback behavior

## Task 7: Wire Settings Persistence with Toast Feedback

- [~] 7.1 Add success toasts to LocationManager after successful location and travel rule creation
- [~] 7.2 Add error toasts to LocationManager for failed creation operations (replace inline-only error)
- [~] 7.3 Verify PreferenceForm already shows success toast via onSaved callback in SettingsPage (no changes needed if working)

## Task 8: Add Delete Confirmation Dialog Component

- [~] 8.1 Create `frontend/src/components/ui/ConfirmDialog.tsx` — a small confirmation modal with message, Confirm, and Cancel buttons
- [~] 8.2 Add ConfirmDialog CSS styles to globals.css
- [~] 8.3 Integrate ConfirmDialog into Tasks page delete flow
