# Requirements Document

## Introduction

This specification covers the complete frontend redesign of the Cog Life Scheduler application. The current frontend is functional but basic — plain CSS, minimal animations, and a utilitarian layout. The redesign transforms every view (Today, Week, Tasks, Settings) into a polished, production-ready lifestyle scheduling app with premium visual design, smooth animations, dark mode support, an integrated AI chatbot panel, and AI-powered automatic scheduling flows. The backend API is fully built and requires no changes; this spec covers only the frontend layer built with Next.js 15, App Router, and plain CSS (with CSS custom properties).

## Glossary

- **App_Shell**: The root layout component containing the Sidebar navigation, main content area, and the persistent Chat_Panel, responsible for managing global layout state including dark mode and chat panel visibility.
- **Sidebar**: The fixed left navigation panel providing links to the Today, Week, Tasks, and Settings views, plus a toggle button for the Chat_Panel and a dark mode toggle.
- **Chat_Panel**: The persistent slide-out panel on the right side of the App_Shell that provides conversational AI interaction, allowing users to create events, ask scheduling questions, and receive AI responses via the POST /api/ai/message endpoint.
- **Today_View**: The primary dashboard page displaying the current day's Schedule_Blocks in chronological order with a generate-plan action, unscheduled item warnings, at-risk assignment alerts, and a repair summary.
- **Week_View**: The seven-day calendar grid page displaying Schedule_Blocks positioned on a time axis from 6 AM to midnight, with day column headers and hour gutter labels.
- **Tasks_View**: The page displaying all Flexible_Tasks and Assignments in card-based lists sorted by priority and urgency, with inline creation and editing capabilities.
- **Settings_View**: The page containing the Preference_Profile editor and Location/Travel_Rule manager forms.
- **Schedule_Generation_Flow**: The frontend UX flow triggered when a user clicks the generate-plan button, which calls POST /api/schedules/generate, displays a loading animation, and renders the resulting Schedule_Plan with visual feedback.
- **Schedule_Repair_Flow**: The frontend UX flow triggered when events change on a date with an existing plan, which calls POST /api/schedules/:id/repair, displays a loading state, and presents a change summary with animated block transitions.
- **Design_Token**: A CSS custom property (variable) defined in the root stylesheet that controls colors, spacing, typography, shadows, and animation timing across the entire application.
- **Loading_Skeleton**: A placeholder animation displayed while data is being fetched, using pulsing rectangular shapes that match the layout of the content being loaded.
- **Micro_Interaction**: A small, targeted animation triggered by user actions such as hover, click, focus, or state change, providing tactile visual feedback.
- **Page_Transition**: An animated transition between route changes within the App_Shell, providing visual continuity as users navigate between views.
- **Dark_Mode**: An alternate color scheme using dark backgrounds and light text, toggled by the user and persisted in localStorage, applied by swapping CSS custom property values on the root element.
- **Block_Animation**: The entrance, exit, and reorder animations applied to Schedule_Block components when a plan is generated, repaired, or when blocks appear on screen.
- **Confirmation_Card**: An inline card within the Chat_Panel that displays a proposed AI action with confirm/reject buttons before the action is applied.

## Requirements

### Requirement 1: Design System and Token Architecture

**User Story:** As a user, I want the app to have a consistent, premium visual identity with clean typography, thoughtful spacing, and cohesive colors, so that the experience feels polished and trustworthy.

#### Acceptance Criteria

1. THE App_Shell SHALL define a complete set of Design_Tokens as CSS custom properties covering color palette (neutral, accent, category, status, surface, and border colors), spacing scale (4px to 64px), typography scale (font families, sizes from 0.75rem to 2rem, weights, line heights, and letter spacing), border radius scale, shadow scale, and animation timing values.
2. THE App_Shell SHALL define a dark mode set of Design_Tokens that overrides background, surface, border, and text color values when Dark_Mode is active, while preserving accent and category hue relationships.
3. WHEN Dark_Mode is active, THE App_Shell SHALL apply the dark Design_Token values by adding a `data-theme="dark"` attribute to the root HTML element.
4. WHEN Dark_Mode is inactive, THE App_Shell SHALL apply the light Design_Token values by removing the `data-theme` attribute or setting `data-theme="light"` on the root HTML element.
5. THE App_Shell SHALL use the Inter font family (loaded via next/font/google) as the primary sans-serif typeface, with JetBrains Mono as the monospace typeface for time displays and code.
6. THE App_Shell SHALL apply responsive breakpoints at 768px (tablet) and 1024px (desktop) using CSS media queries, adjusting layout, spacing, and font sizes at each breakpoint.

### Requirement 2: App Shell and Sidebar Redesign

**User Story:** As a user, I want a clean, modern navigation sidebar with smooth interactions and quick access to the AI chat, so that moving between views feels seamless and the AI assistant is always one click away.

#### Acceptance Criteria

1. THE Sidebar SHALL display the application logo, navigation links (Today, Week, Tasks, Settings), a Chat_Panel toggle button, and a Dark_Mode toggle button in a vertically stacked layout.
2. WHEN a user hovers over a Sidebar navigation link, THE Sidebar SHALL display a background highlight transition completing within 150 milliseconds.
3. WHEN a Sidebar navigation link is the active route, THE Sidebar SHALL display the link with an accent-colored left border indicator and accent-tinted background.
4. WHEN a user clicks the Chat_Panel toggle button, THE App_Shell SHALL slide the Chat_Panel into view from the right edge with a CSS transition completing within 300 milliseconds.
5. WHEN a user clicks the Dark_Mode toggle button, THE App_Shell SHALL toggle between light and dark Design_Token sets and persist the preference to localStorage.
6. WHEN the viewport width is below 768px, THE Sidebar SHALL collapse to an icon-only mode with a hamburger menu button to expand the full sidebar as an overlay.
7. THE Sidebar SHALL render navigation link icons as inline SVG elements with a consistent 20px by 20px viewBox.

### Requirement 3: Today View Redesign

**User Story:** As a user, I want the Today view to feel like a premium daily planner with clear visual hierarchy, animated block placement, and intuitive schedule generation, so that I can see my day at a glance and generate plans effortlessly.

#### Acceptance Criteria

1. THE Today_View SHALL display a header section containing the relative date label (Today, Tomorrow, or formatted date), the full formatted date, and a generate-plan button.
2. THE Today_View SHALL display Schedule_Blocks in a vertical chronological list with each block showing the time range, title, source type badge, category color-coded left border, and lock indicator.
3. WHEN a Schedule_Plan is loaded, THE Today_View SHALL animate each Schedule_Block into view with a staggered fade-and-slide-up entrance animation, with each block delayed by 50 milliseconds from the previous block.
4. WHEN a user clicks a Schedule_Block, THE Today_View SHALL open the Block_Detail panel with a slide-in-from-right animation completing within 250 milliseconds.
5. WHEN unscheduled items exist, THE Today_View SHALL display a warning section with amber-tinted cards listing each unscheduled item's title and reason.
6. WHEN at-risk assignments exist, THE Today_View SHALL display a warning section with red-tinted cards listing each at-risk assignment's title and shortfall duration.
7. WHEN a repair summary is available, THE Today_View SHALL display a Repair_Summary component showing moved, added, and removed blocks with color-coded indicators.
8. THE Today_View SHALL display a Loading_Skeleton with three pulsing rectangular placeholders while the schedule data is being fetched.

### Requirement 4: Schedule Generation UX Flow

**User Story:** As a user, I want one-click plan generation with smooth visual feedback, so that I can generate my daily schedule and see it appear with satisfying animations.

#### Acceptance Criteria

1. WHEN a user clicks the generate-plan button, THE Schedule_Generation_Flow SHALL disable the button, display a spinning loading indicator on the button, and call POST /api/schedules/generate with the current date.
2. WHEN the generate API call succeeds, THE Schedule_Generation_Flow SHALL render the new Schedule_Blocks with staggered entrance animations and display a brief success toast notification that auto-dismisses after 3 seconds.
3. IF the generate API call fails, THEN THE Schedule_Generation_Flow SHALL re-enable the button, display an error toast notification with the error message, and the toast SHALL auto-dismiss after 5 seconds.
4. WHEN the generate API call returns unscheduled items, THE Schedule_Generation_Flow SHALL display the unscheduled items warning section with a fade-in animation.
5. WHEN the generate API call returns at-risk assignments, THE Schedule_Generation_Flow SHALL display the at-risk assignments warning section with a fade-in animation.

### Requirement 5: Schedule Repair UX Flow

**User Story:** As a user, I want the app to prompt me to repair my schedule when things change, with clear visual feedback showing what moved, so that disruptions are handled smoothly.

#### Acceptance Criteria

1. WHEN a Schedule_Plan exists for the current date and the user modifies a Fixed_Event on that date, THE Schedule_Repair_Flow SHALL display a repair prompt banner asking the user to repair the schedule.
2. WHEN the user confirms the repair prompt, THE Schedule_Repair_Flow SHALL call POST /api/schedules/:id/repair, display a loading overlay on the schedule list, and animate block transitions when the repair completes.
3. WHEN the repair API call returns a change summary, THE Schedule_Repair_Flow SHALL display the Repair_Summary component with moved blocks shown in blue, added blocks shown in green, and removed blocks shown in red.
4. WHEN the user has auto-repair enabled in preferences, THE Schedule_Repair_Flow SHALL automatically trigger repair without showing the prompt banner.
5. IF the repair API call fails, THEN THE Schedule_Repair_Flow SHALL display an error toast notification with the error message.

### Requirement 6: Week View Redesign

**User Story:** As a user, I want a polished Google Calendar-style week view with smooth block rendering and clear day/time orientation, so that I can see my entire week at a glance.

#### Acceptance Criteria

1. THE Week_View SHALL display a header with the current month and year, and a color-coded legend for event types (Events, Tasks, Assignments, Travel).
2. THE Week_View SHALL display seven day column headers showing the abbreviated day name and day number, with the current day highlighted using an accent-colored circular background on the day number.
3. THE Week_View SHALL display a scrollable time grid from 6 AM to midnight with hour labels in the left gutter and horizontal grid lines at each hour boundary.
4. THE Week_View SHALL position Schedule_Blocks as absolutely-positioned elements within their day column, with top offset and height calculated from the block's start and end times relative to the grid's hour height.
5. WHEN a user clicks a Schedule_Block in the Week_View, THE Week_View SHALL open the Block_Detail panel with a slide-in animation.
6. WHEN Schedule_Blocks are loaded, THE Week_View SHALL animate blocks into view with a fade-in animation completing within 200 milliseconds.
7. THE Week_View SHALL display a Loading_Skeleton with pulsing column placeholders while the week schedule data is being fetched.

### Requirement 7: Tasks View Redesign

**User Story:** As a user, I want a clean, organized task management view with visual priority indicators and progress tracking, so that I can see all my tasks and assignments at a glance.

#### Acceptance Criteria

1. THE Tasks_View SHALL display two sections: Flexible Tasks sorted by priority (critical first) and Assignments sorted by urgency score (highest first).
2. THE Tasks_View SHALL display each Flexible_Task as a card showing the title, priority badge with color coding (critical: red, high: amber, medium: default, low: muted), remaining duration, due date, minimum session length, and energy requirement.
3. THE Tasks_View SHALL display each Assignment as a card showing the title, urgency percentage badge, remaining duration, deadline date, progress percentage, and a horizontal progress bar with animated fill.
4. WHEN a user hovers over a task or assignment card, THE Tasks_View SHALL apply a subtle elevation increase (shadow transition) completing within 150 milliseconds.
5. THE Tasks_View SHALL display a Loading_Skeleton with four pulsing card placeholders while the task data is being fetched.
6. WHEN the task list is empty, THE Tasks_View SHALL display an empty state illustration with a descriptive message.

### Requirement 8: Settings View Redesign

**User Story:** As a user, I want a well-organized settings page with clear form sections and visual feedback on save, so that configuring my preferences feels straightforward.

#### Acceptance Criteria

1. THE Settings_View SHALL display the Preference_Profile form and the Location/Travel_Rule manager as distinct card sections with clear headings and consistent spacing.
2. THE Settings_View SHALL display form inputs with visible focus states using an accent-colored border and subtle box shadow when focused.
3. WHEN a user saves preferences successfully, THE Settings_View SHALL display a success toast notification that auto-dismisses after 3 seconds.
4. IF a preference save fails with validation errors, THEN THE Settings_View SHALL display inline error messages below the invalid fields with red text.
5. THE Settings_View SHALL display the auto-repair toggle as a styled switch component rather than a plain checkbox.

### Requirement 9: AI Chat Panel Redesign

**User Story:** As a user, I want a polished, persistent AI chat panel where I can conversationally manage my schedule, so that interacting with the AI assistant feels natural and integrated.

#### Acceptance Criteria

1. THE Chat_Panel SHALL display as a fixed right-side panel with a header (title and close button), a scrollable message area, and a bottom input bar with a text field and send button.
2. WHEN the Chat_Panel opens, THE Chat_Panel SHALL animate in from the right edge with a slide transition completing within 300 milliseconds.
3. WHEN the Chat_Panel closes, THE Chat_Panel SHALL animate out to the right edge with a slide transition completing within 250 milliseconds.
4. THE Chat_Panel SHALL display user messages as right-aligned bubbles with the accent color background and assistant messages as left-aligned bubbles with a surface-tinted background.
5. WHEN the AI assistant is processing a message, THE Chat_Panel SHALL display an animated typing indicator with three pulsing dots.
6. WHEN an AI response includes a confirmation requirement, THE Chat_Panel SHALL display a Confirmation_Card inline below the assistant message with the action summary, intent label, confirm button, and cancel button.
7. WHEN the message area is empty, THE Chat_Panel SHALL display a welcome message with example prompts the user can click to auto-fill the input field.
8. WHEN a new message is added, THE Chat_Panel SHALL auto-scroll to the bottom of the message area with a smooth scroll behavior.
9. THE Chat_Panel SHALL support sending messages by pressing the Enter key in the input field.

### Requirement 10: Animation and Micro-Interaction System

**User Story:** As a user, I want smooth, purposeful animations throughout the app, so that interactions feel responsive and the experience feels premium.

#### Acceptance Criteria

1. THE App_Shell SHALL define CSS animation keyframes for fade-in, fade-out, slide-up, slide-down, slide-in-right, slide-out-right, scale-in, and pulse animations.
2. WHEN a user navigates between views, THE App_Shell SHALL apply a Page_Transition with a fade animation completing within 200 milliseconds.
3. WHEN a button is clicked, THE button SHALL apply a subtle scale-down transform (scale 0.97) for 100 milliseconds followed by a return to normal scale.
4. WHEN a card or interactive element receives hover, THE element SHALL apply a shadow elevation transition completing within 150 milliseconds.
5. WHEN a toast notification appears, THE toast SHALL slide in from the top-right with a slide-down animation and auto-dismiss with a fade-out animation.
6. THE App_Shell SHALL respect the user's prefers-reduced-motion media query by disabling all animations and transitions when the user has requested reduced motion.

### Requirement 11: Loading States and Skeleton Screens

**User Story:** As a user, I want to see placeholder content while data loads, so that the app feels fast and I understand that content is on its way.

#### Acceptance Criteria

1. THE App_Shell SHALL define a Loading_Skeleton component that renders pulsing rectangular placeholder shapes with rounded corners and a shimmer gradient animation.
2. WHEN the Today_View is loading schedule data, THE Today_View SHALL display three skeleton block placeholders matching the height and layout of Schedule_Block components.
3. WHEN the Week_View is loading schedule data, THE Week_View SHALL display skeleton column placeholders within the time grid.
4. WHEN the Tasks_View is loading task data, THE Tasks_View SHALL display four skeleton card placeholders matching the height and layout of task cards.
5. WHEN the Settings_View is loading preference data, THE Settings_View SHALL display skeleton form field placeholders.

### Requirement 12: Toast Notification System

**User Story:** As a user, I want brief, non-intrusive notifications for success and error states, so that I know when actions complete without blocking my workflow.

#### Acceptance Criteria

1. THE App_Shell SHALL provide a toast notification system that displays messages in the top-right corner of the viewport, stacked vertically with spacing between multiple toasts.
2. WHEN a success toast is triggered, THE toast system SHALL display a green-tinted toast with a checkmark icon and the success message, auto-dismissing after 3 seconds.
3. WHEN an error toast is triggered, THE toast system SHALL display a red-tinted toast with an error icon and the error message, auto-dismissing after 5 seconds.
4. WHEN a toast is dismissed (automatically or by user click), THE toast SHALL animate out with a fade-and-slide-up exit animation completing within 200 milliseconds.
5. THE toast system SHALL support displaying up to three simultaneous toasts, with older toasts dismissed when the limit is exceeded.

### Requirement 13: Responsive Layout

**User Story:** As a user, I want the app to work well on different screen sizes, so that I can use it on my laptop, tablet, or phone.

#### Acceptance Criteria

1. WHEN the viewport width is 1024px or wider, THE App_Shell SHALL display the Sidebar in expanded mode (220px width) with icon and text labels, and the main content area filling the remaining width.
2. WHEN the viewport width is between 768px and 1023px, THE Sidebar SHALL collapse to icon-only mode (60px width) with tooltips on hover showing the link labels.
3. WHEN the viewport width is below 768px, THE Sidebar SHALL be hidden by default and accessible via a hamburger menu button, and the main content area SHALL fill the full viewport width.
4. WHEN the viewport width is below 768px, THE Chat_Panel SHALL expand to full viewport width instead of the fixed 380px width.
5. THE Week_View time grid SHALL support horizontal scrolling on viewports narrower than 768px to accommodate all seven day columns.

### Requirement 14: Block Detail Panel Redesign

**User Story:** As a user, I want a polished detail panel when I click a schedule block, so that I can see the block's information and AI explanation in a clean, readable format.

#### Acceptance Criteria

1. THE Block_Detail panel SHALL display as a fixed right-side panel showing the block title, time range, source type label, lock status, and the AI-generated explanation text.
2. WHEN the Block_Detail panel opens, THE panel SHALL animate in from the right with a slide transition completing within 250 milliseconds.
3. WHEN the Block_Detail panel closes, THE panel SHALL animate out to the right with a slide transition completing within 200 milliseconds.
4. THE Block_Detail panel SHALL display a lock/unlock toggle button styled as a pill-shaped toggle with an icon, changing appearance based on the current lock state.
5. WHEN the explanation is loading, THE Block_Detail panel SHALL display a skeleton text placeholder with a shimmer animation.
6. THE Block_Detail panel SHALL close when the user presses the Escape key.

### Requirement 15: Form Component Redesign

**User Story:** As a user, I want forms for creating events, tasks, and assignments to feel modern and responsive, so that data entry is quick and pleasant.

#### Acceptance Criteria

1. THE EventForm, TaskForm, and PreferenceForm components SHALL use consistent form field styling with floating or stacked labels, rounded input borders, and visible focus ring transitions.
2. WHEN a form field receives focus, THE field SHALL display an accent-colored border and a subtle outer glow completing the transition within 150 milliseconds.
3. WHEN a form submission is in progress, THE submit button SHALL display a loading spinner and be disabled until the operation completes.
4. WHEN a form submission succeeds, THE form SHALL trigger a success toast notification.
5. IF a form submission fails with validation errors, THEN THE form SHALL display inline error messages below each invalid field with a fade-in animation.
6. THE RecurrenceSelector component SHALL display day-of-week buttons as circular toggles with smooth active-state transitions.
