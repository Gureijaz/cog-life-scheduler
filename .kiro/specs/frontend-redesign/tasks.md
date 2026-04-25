# Implementation Tasks

## Task 1: Design Token System and Global CSS Rewrite
- [x] 1.1 Rewrite globals.css with complete design token system: light theme variables (backgrounds, borders, text, accent, category, status, shadows, spacing, typography, animation timing), dark theme overrides under `[data-theme="dark"]`, CSS keyframe animations (fadeIn, fadeOut, slideUp, slideDown, slideInRight, slideOutRight, scaleIn, shimmer, pulse), and prefers-reduced-motion override
- [x] 1.2 Update layout.tsx to load Inter font via next/font/google and apply it as the primary font family, with JetBrains Mono as monospace fallback
- [x] 1.3 Add responsive breakpoint styles in globals.css for tablet (768px) and desktop (1024px) with adjusted spacing and font sizes

## Task 2: Theme System (Dark Mode)
- [x] 2.1 Create hooks/useTheme.ts with ThemeContext providing theme state ('light' | 'dark'), toggleTheme function, localStorage persistence under key 'cog-theme', and data-theme attribute management on document.documentElement
- [x] 2.2 Create a ThemeProvider wrapper component and integrate it into layout.tsx wrapping the app content

## Task 3: Toast Notification System
- [x] 3.1 Create hooks/useToast.ts with ToastContext providing toast queue (max 3), addToast(type, message) function, removeToast(id) function, auto-dismiss timers (3s success, 5s error)
- [x] 3.2 Create components/ui/ToastProvider.tsx that wraps children and renders the toast container
- [x] 3.3 Create components/ui/Toast.tsx component rendering individual toasts with success (green + checkmark) and error (red + X icon) variants, slide-down entrance animation, fade-out exit animation, and click-to-dismiss
- [x] 3.4 Add toast CSS styles to globals.css: fixed top-right positioning, stacked layout, animation classes
- [x] 3.5 Integrate ToastProvider into layout.tsx wrapping the app content

## Task 4: Loading Skeleton Component
- [x] 4.1 Create components/ui/LoadingSkeleton.tsx with variants: 'block' (schedule block height), 'card' (task card height), 'text' (single line), 'column' (week grid column), with configurable count prop
- [x] 4.2 Add skeleton CSS styles to globals.css: shimmer gradient animation, rounded corners, pulsing opacity

## Task 5: Sidebar Redesign
- [x] 5.1 Redesign Sidebar.tsx: add Chat_Panel toggle button (message bubble SVG icon), Dark_Mode toggle button (sun/moon SVG icon using useTheme), updated styling with accent left-border active indicator, 150ms hover transitions
- [x] 5.2 Add responsive sidebar behavior: expanded at ≥1024px, icon-only at 768-1023px with hover tooltips, hidden at <768px with hamburger menu button
- [x] 5.3 Update layout.tsx to manage chatOpen state and pass onChatToggle to Sidebar, render ChatPanel conditionally
- [x] 5.4 Add updated sidebar CSS to globals.css: responsive widths, icon-only mode, hamburger overlay, tooltip styles

## Task 6: Today View Redesign
- [x] 6.1 Redesign page.tsx (Today view): replace loading text with LoadingSkeleton variant='block' count=3, add --stagger-index CSS variable to each ScheduleBlock for staggered entrance animation
- [x] 6.2 Add toast notifications to Today view: success toast on generate completion, error toast on generate/repair failure
- [x] 6.3 Add repair prompt banner: display when a plan exists and events change, with "Repair Schedule" button that triggers repairSchedule, auto-trigger if autoRepairEnabled
- [x] 6.4 Update Today view CSS in globals.css: staggered slideUp animation on blocks, fade-in for warning sections, updated header typography

## Task 7: Schedule Block Component Redesign
- [x] 7.1 Redesign ScheduleBlock.tsx: update category colors to new design tokens, add hover shadow elevation transition (150ms), add stagger animation support via --stagger-index custom property, update lock icon styling
- [x] 7.2 Update schedule block CSS in globals.css: new color tokens, hover elevation, active press scale(0.97) for 100ms, updated border-left colors

## Task 8: Block Detail Panel Redesign
- [x] 8.1 Redesign BlockDetail.tsx: add slideInRight/slideOutRight CSS animation on open/close, add Escape key listener to close panel, add LoadingSkeleton for explanation loading state, style lock/unlock as pill toggle button
- [x] 8.2 Update block detail CSS in globals.css: slide animations, pill toggle styles, skeleton placeholder, updated typography

## Task 9: Week View Redesign
- [x] 9.1 Redesign week/page.tsx: replace loading text with LoadingSkeleton variant='column', add fade-in animation on blocks when loaded
- [x] 9.2 Update WeekGrid.tsx: apply fadeIn animation to event blocks, update colors to new design tokens, ensure horizontal scroll on mobile
- [x] 9.3 Update week view CSS in globals.css: updated header typography, fade-in block animation, mobile horizontal scroll, updated color tokens

## Task 10: Tasks View Redesign
- [x] 10.1 Redesign tasks/page.tsx: replace loading text with LoadingSkeleton variant='card' count=4, add hover elevation on task/assignment cards (150ms shadow transition), add empty state with descriptive message when lists are empty
- [x] 10.2 Update task card CSS in globals.css: hover elevation, updated priority badge colors (critical: red, high: amber), updated progress bar animation, empty state styling

## Task 11: Settings View Redesign
- [x] 11.1 Redesign settings/page.tsx: replace loading text with LoadingSkeleton variant='text', add toast notifications on save success/error
- [x] 11.2 Redesign PreferenceForm.tsx: style auto-repair toggle as a CSS switch component instead of plain checkbox, add focus ring transitions on all inputs
- [x] 11.3 Update settings CSS in globals.css: card section layout, toggle switch styles, focus ring transitions, updated typography

## Task 12: AI Chat Panel Redesign
- [x] 12.1 Redesign ChatPanel.tsx: add slideInRight/slideOutRight CSS animation on open/close, add animated typing indicator (three pulsing dots) when sending, add empty state with welcome message and clickable example prompts, add Enter key to send handler, full-width on mobile (<768px)
- [x] 12.2 Redesign MessageBubble.tsx: update bubble colors to use design tokens (accent for user, surface-raised for assistant), ensure dark mode compatibility
- [x] 12.3 Redesign ConfirmationCard.tsx: update styling with accent border, updated button styles using design tokens
- [x] 12.4 Update chat panel CSS in globals.css: slide animations, typing indicator dots animation, example prompt buttons, responsive full-width, updated bubble colors

## Task 13: Form Component Redesign
- [x] 13.1 Update EventForm.tsx: add focus ring transitions (accent border + subtle glow on focus), loading spinner on submit button while saving, trigger success toast on save
- [x] 13.2 Update TaskForm.tsx: add focus ring transitions, loading spinner on submit, trigger success toast on save
- [x] 13.3 Update form field CSS in globals.css: focus ring with box-shadow transition (150ms), updated input styling, loading spinner keyframe on buttons

## Task 14: Page Transition Animation
- [x] 14.1 Add page transition wrapper in layout.tsx: wrap main content area with a CSS class that applies fadeIn animation (200ms) on route change using key={pathname}
- [x] 14.2 Add page transition CSS to globals.css: fadeIn animation class for main content area

## Task 15: Final Polish and Integration Testing
- [x] 15.1 Verify all views render correctly in both light and dark mode by visual inspection
- [x] 15.2 Verify responsive layout at all three breakpoints (mobile <768px, tablet 768-1023px, desktop ≥1024px)
- [x] 15.3 Verify prefers-reduced-motion disables all animations
- [x] 15.4 Run existing frontend tests to ensure no regressions: `npm test` in frontend directory
