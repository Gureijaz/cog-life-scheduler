# Design Document: Frontend Redesign

## Overview

This design covers the complete frontend redesign of the Cog Life Scheduler. The existing Next.js 15 App Router frontend is transformed from a basic functional UI into a production-ready, premium lifestyle scheduling app. The redesign uses plain CSS with CSS custom properties (no CSS-in-JS or utility frameworks), React hooks for state management, and the existing backend API without modification.

The design follows these principles:
1. **CSS-only animations** — All animations use CSS keyframes and transitions, no animation libraries
2. **Progressive enhancement** — Respects prefers-reduced-motion, works without JS for initial render
3. **Token-driven theming** — All visual properties flow from CSS custom properties, enabling dark mode via attribute swap
4. **Minimal new dependencies** — Only `next/font/google` for Inter font loading; no new npm packages

### Key Design Decisions

1. **Plain CSS with custom properties over Tailwind/CSS-in-JS**: Maintains consistency with the existing codebase, avoids build complexity, and keeps the bundle small. CSS custom properties provide theming without runtime cost.
2. **CSS keyframe animations over Framer Motion**: Keeps the bundle lean and avoids React re-render overhead for animations. CSS animations are GPU-accelerated and respect prefers-reduced-motion natively.
3. **React Context for toast/theme state over external state library**: The app is single-user with simple state needs. React Context + useReducer is sufficient for toast queue and theme toggle without adding Redux/Zustand.
4. **localStorage for theme persistence over cookies**: Simple client-side persistence for dark mode preference. No SSR theme flash concern since the app is fully client-rendered.
5. **Staggered CSS animations via custom properties over JS-driven stagger**: Using `--stagger-index` CSS custom property on each block allows pure CSS stagger without JavaScript animation orchestration.

## Architecture

### Component Architecture

```
src/
├── app/
│   ├── layout.tsx                 # Root layout — ThemeProvider, ToastProvider, font loading
│   ├── page.tsx                   # Today view (redesigned)
│   ├── week/page.tsx              # Week view (redesigned)
│   ├── tasks/page.tsx             # Tasks view (redesigned)
│   └── settings/page.tsx          # Settings view (redesigned)
├── components/
│   ├── calendar/
│   │   ├── BlockDetail.tsx        # Redesigned detail panel with slide animation, Escape close
│   │   ├── FreeTimeSlot.tsx       # Unchanged
│   │   ├── RepairSummary.tsx      # Unchanged (already well-structured)
│   │   ├── ScheduleBlock.tsx      # Redesigned with hover elevation, stagger animation
│   │   └── WeekGrid.tsx           # Redesigned with fade-in blocks, loading skeleton
│   ├── chat/
│   │   ├── ChatPanel.tsx          # Redesigned persistent panel with slide animation
│   │   ├── ConfirmationCard.tsx   # Redesigned with accent styling
│   │   └── MessageBubble.tsx      # Redesigned with dark mode support
│   ├── events/
│   │   ├── EventForm.tsx          # Redesigned form fields with focus rings
│   │   └── RecurrenceSelector.tsx # Unchanged (already well-styled)
│   ├── settings/
│   │   ├── LocationManager.tsx    # Redesigned card layout
│   │   └── PreferenceForm.tsx     # Redesigned with toggle switch
│   ├── tasks/
│   │   └── TaskForm.tsx           # Redesigned form fields
│   ├── ui/                        # NEW — shared UI primitives
│   │   ├── LoadingSkeleton.tsx    # Reusable skeleton component
│   │   ├── Toast.tsx              # Toast notification component
│   │   └── ToastProvider.tsx      # Toast context provider
│   └── Sidebar.tsx                # Redesigned with chat toggle, dark mode toggle
├── hooks/
│   ├── useChat.ts                 # Unchanged
│   ├── useSchedule.ts            # Unchanged
│   ├── useTheme.ts               # NEW — dark mode toggle + localStorage persistence
│   └── useToast.ts               # NEW — toast notification hook
├── lib/
│   ├── api.ts                     # Unchanged
│   ├── types.ts                   # Unchanged
│   └── utils.ts                   # Unchanged
└── styles/
    └── globals.css                # Complete rewrite — design tokens, dark mode, animations
```

### State Management

```mermaid
graph TB
    subgraph Providers["React Context Providers (layout.tsx)"]
        ThemeCtx[ThemeContext<br/>theme: light|dark<br/>toggle: fn]
        ToastCtx[ToastContext<br/>toasts: Toast[]<br/>addToast: fn<br/>removeToast: fn]
    end

    subgraph Pages["Page Components"]
        Today[TodayPage]
        Week[WeekPage]
        Tasks[TasksPage]
        Settings[SettingsPage]
    end

    subgraph Hooks["Custom Hooks"]
        useTheme[useTheme]
        useToast[useToast]
        useSchedule[useSchedule]
        useChat[useChat]
    end

    ThemeCtx --> useTheme
    ToastCtx --> useToast
    Today --> useSchedule
    Today --> useToast
    Week --> useSchedule
    Tasks --> useToast
    Settings --> useToast
    Sidebar --> useTheme
```

### Animation System

All animations are CSS-only, defined as keyframes in globals.css:

```css
/* Core keyframes */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes slideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
```

Staggered block entrance uses a CSS custom property:
```css
.schedule-block { animation: slideUp 0.3s ease-out both; animation-delay: calc(var(--stagger-index, 0) * 50ms); }
```

Reduced motion override:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

## Components and Interfaces

### ThemeProvider & useTheme

```typescript
// hooks/useTheme.ts
interface ThemeContextValue {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Reads initial value from localStorage('cog-theme'), defaults to 'light'
// Sets data-theme attribute on document.documentElement
// Persists changes to localStorage
```

### ToastProvider & useToast

```typescript
// hooks/useToast.ts
interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: 'success' | 'error', message: string) => void;
  removeToast: (id: string) => void;
}

// Max 3 simultaneous toasts
// Success auto-dismiss: 3000ms
// Error auto-dismiss: 5000ms
```

### LoadingSkeleton

```typescript
// components/ui/LoadingSkeleton.tsx
interface LoadingSkeletonProps {
  variant: 'block' | 'card' | 'text' | 'column';
  count?: number;  // Number of skeleton items to render
}

// Renders pulsing rectangles with shimmer gradient
// 'block' — matches ScheduleBlock height (~60px)
// 'card' — matches task card height (~100px)
// 'text' — single line text placeholder
// 'column' — tall column for week grid
```

### Toast Component

```typescript
// components/ui/Toast.tsx
interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

// Renders in top-right corner via portal or fixed positioning
// Success: green tint + checkmark icon
// Error: red tint + X icon
// Slide-down entrance, fade-out exit
```

### Redesigned Sidebar

```typescript
// components/Sidebar.tsx — additions:
// - Chat toggle button (message bubble icon) that calls onChatToggle prop
// - Dark mode toggle button (sun/moon icon) using useTheme hook
// - Responsive: full at ≥1024px, icon-only at 768-1023px, hidden at <768px
// - Mobile hamburger menu button in header area
```

### Redesigned ChatPanel

```typescript
// components/chat/ChatPanel.tsx — additions:
// - Slide-in/out CSS animation (slideInRight/slideOutRight)
// - Typing indicator: three animated dots when sending=true
// - Empty state: welcome message + clickable example prompts
// - Enter key to send (onKeyDown handler)
// - Full-width on mobile (<768px)
```

### Redesigned BlockDetail

```typescript
// components/calendar/BlockDetail.tsx — additions:
// - Slide-in/out CSS animation
// - Escape key to close (useEffect with keydown listener)
// - Skeleton placeholder while explanation loads
// - Styled lock/unlock pill toggle
```

### Page-Level Changes

**TodayPage (page.tsx)**:
- Loading skeleton instead of text "Loading…"
- Staggered block entrance animations via `--stagger-index` CSS variable
- Toast notifications for generate success/error
- Repair prompt banner when events change

**WeekPage (week/page.tsx)**:
- Loading skeleton columns
- Fade-in block animations
- Consistent header styling with design tokens

**TasksPage (tasks/page.tsx)**:
- Loading skeleton cards
- Hover elevation on cards
- Empty state with illustration placeholder
- Toast notifications for CRUD operations

**SettingsPage (settings/page.tsx)**:
- Card-based section layout
- Styled toggle switch for auto-repair
- Toast notifications for save success/error
- Skeleton form placeholders while loading

## Design Tokens

### Light Theme (default)

```css
:root {
  /* Backgrounds */
  --color-bg: #fafaf9;
  --color-surface: #ffffff;
  --color-surface-raised: #ffffff;
  --color-surface-overlay: rgba(255, 255, 255, 0.95);

  /* Borders */
  --color-border: #e7e5e4;
  --color-border-light: #f5f5f4;
  --color-border-focus: var(--color-primary);

  /* Text */
  --color-text: #1c1917;
  --color-text-secondary: #78716c;
  --color-text-muted: #a8a29e;
  --color-text-inverse: #ffffff;

  /* Accent */
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-primary-light: #eef2ff;
  --color-primary-subtle: rgba(99, 102, 241, 0.1);

  /* Category colors */
  --color-fixed-event: #6366f1;
  --color-flexible-task: #10b981;
  --color-assignment: #f59e0b;
  --color-travel-buffer: #94a3b8;

  /* Status */
  --color-success: #10b981;
  --color-success-light: #ecfdf5;
  --color-warning: #f59e0b;
  --color-warning-light: #fffbeb;
  --color-danger: #ef4444;
  --color-danger-light: #fef2f2;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
  --shadow-focus: 0 0 0 3px var(--color-primary-subtle);

  /* Animation */
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Dark Theme

```css
[data-theme="dark"] {
  --color-bg: #0f0f0f;
  --color-surface: #1a1a1a;
  --color-surface-raised: #242424;
  --color-surface-overlay: rgba(26, 26, 26, 0.95);
  --color-border: #2e2e2e;
  --color-border-light: #1f1f1f;
  --color-text: #f5f5f4;
  --color-text-secondary: #a8a29e;
  --color-text-muted: #78716c;
  --color-primary-light: rgba(99, 102, 241, 0.15);
  --color-primary-subtle: rgba(99, 102, 241, 0.2);
  --color-success-light: rgba(16, 185, 129, 0.15);
  --color-warning-light: rgba(245, 158, 11, 0.15);
  --color-danger-light: rgba(239, 68, 68, 0.15);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
}
```

## Correctness Properties

### Property 1: Theme Toggle Round-Trip

*For any* initial theme state (light or dark), toggling the theme twice SHALL return the theme to its original state, and the `data-theme` attribute on the root element SHALL match the current theme state after each toggle.

**Validates: Requirements 1.3, 1.4, 2.5**

### Property 2: Toast Queue Invariant

*For any* sequence of addToast and removeToast operations, the toast queue SHALL never contain more than 3 toasts simultaneously, and every toast that is added SHALL eventually be removed (either by auto-dismiss timeout or manual dismissal).

**Validates: Requirements 12.5**

### Property 3: Stagger Index Monotonicity

*For any* list of N schedule blocks rendered in the Today view, the `--stagger-index` CSS custom property on the Nth block SHALL equal N-1 (zero-indexed), ensuring monotonically increasing animation delays.

**Validates: Requirements 3.3**

### Property 4: Theme Persistence Round-Trip

*For any* theme value written to localStorage, reading the value back from localStorage SHALL produce the same theme value, and the ThemeProvider SHALL initialize with the persisted value on mount.

**Validates: Requirements 2.5**

### Property 5: Responsive Sidebar State

*For any* viewport width, the Sidebar SHALL be in exactly one of three states: expanded (≥1024px), collapsed icon-only (768-1023px), or hidden with hamburger (< 768px). No viewport width SHALL result in an undefined sidebar state.

**Validates: Requirements 2.6, 13.1, 13.2, 13.3**

### Property 6: Reduced Motion Disables Animations

*For any* component with CSS animations, when the prefers-reduced-motion media query matches "reduce", all animation-duration and transition-duration values SHALL be effectively zero (≤ 0.01ms).

**Validates: Requirements 10.6**
