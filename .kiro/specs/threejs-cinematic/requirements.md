# Requirements Document: Three.js Cinematic 3D Animations

## Requirement 1: Persistent 3D Background Scene

### User Story
As a user, I want a persistent animated 3D environment behind the entire app so that the scheduler feels like a cinematic, immersive sci-fi experience.

### Acceptance Criteria
- 1.1 A full-viewport Three.js canvas (via `@react-three/fiber`) renders behind all UI content at z-index layer 1, with `pointer-events: none` so it never blocks UI interaction.
- 1.2 The scene contains at least 15 floating geometric shapes (icosahedrons, octahedrons, tori, torusKnots, dodecahedrons) distributed within a configurable spread radius, each with independent rotation speeds and gentle bobbing via drei's `<Float>`.
- 1.3 A star field (via drei's `<Stars>`) renders in the background with opacity controlled by time of day (0 during morning/afternoon, 0.3 during evening, 1.0 at night).
- 1.4 Ambient and directional lighting transitions smoothly between four time-of-day palettes (morning: warm gold, afternoon: bright blue, evening: purple/orange, night: deep blue) based on the user's local clock, with interpolation over 30-60 seconds when the period changes.
- 1.5 Post-processing effects (Bloom, Chromatic Aberration, Vignette) are applied via `@react-three/postprocessing` with bloom using half-resolution render targets.
- 1.6 The scene reacts to mouse movement with parallax: the camera offsets subtly (bounded by configurable intensity, default ±1.5 units) with exponential smoothing for a buttery feel.
- 1.7 The SceneCanvas component is dynamically imported via `next/dynamic` with `ssr: false` and does not execute during server-side rendering.
- 1.8 When `prefers-reduced-motion: reduce` is active, all scene animations (floating, rotation, parallax) are disabled and the scene renders as a static frame or falls back to a gradient background.

## Requirement 2: Cinematic Page Transitions

### User Story
As a user, I want navigating between views (Today, Week, Tasks, Settings) to feel like flying through a sci-fi interface, with the camera zooming and panning through 3D space.

### Acceptance Criteria
- 2.1 Each page route (/, /week, /tasks, /settings) maps to a unique 3D camera position and lookAt target defined in a `PAGE_CAMERA_POSITIONS` configuration object.
- 2.2 When navigating between routes, the camera animates from the current position to the target position using spring physics (configurable stiffness, damping, mass) via `@react-spring/three`, completing within approximately 800ms.
- 2.3 The 2D page content transitions are handled by Framer Motion's `<AnimatePresence>` with `mode="wait"`: the exiting page fades out and scales down, the entering page fades in and scales up, layered on top of the 3D camera movement.
- 2.4 A `useCinematicNavigation` hook exposes `currentRoute`, `cameraTarget`, `isTransitioning`, and `navigateTo(route)` — coordinating both the camera animation and Next.js router navigation.
- 2.5 During a transition, `isTransitioning` is true and the camera spring is actively animating; it becomes false when the camera settles within ε of the target position.
- 2.6 When `prefers-reduced-motion` is active, page transitions use instant cuts (no camera animation, no Framer Motion animation).

## Requirement 3: 3D Schedule Visualization

### User Story
As a user, I want to view my weekly schedule as a 3D holographic bar chart that I can orbit around and interact with, like a Minority Report-style display.

### Acceptance Criteria
- 3.1 The Week view includes a toggle button to switch between the existing 2D `WeekGrid` and a new 3D `ScheduleVisualization3D` component.
- 3.2 In 3D mode, schedule blocks render as 3D bars on a 7-column (days) × 18-row (hours 6AM-midnight) grid, with bar height proportional to block duration and position corresponding to start time.
- 3.3 Each bar uses an emissive `MeshStandardMaterial` that glows with its category color (fixed_event: #6366f1, flexible_task: #10b981, assignment: #f59e0b, travel_buffer: #94a3b8) with emissive intensity of 0.4.
- 3.4 Users can orbit around the 3D visualization using drei's `<OrbitControls>` (rotate, zoom, pan) — this is the only part of the 3D scene that accepts pointer events.
- 3.5 Hovering over a bar increases its emissive intensity to 0.8 and displays a tooltip with the block title and time range.
- 3.6 Clicking a bar triggers the `onBlockSelect` callback, opening the existing `BlockDetail` panel.
- 3.7 Grid lines render as thin wireframe planes with subtle glow to establish the time/day axes.
- 3.8 The `ScheduleVisualization3D` component is dynamically imported with `ssr: false`.

## Requirement 4: Particle Effects System

### User Story
As a user, I want explosive particle effects when generating schedules, dissolving particles when deleting items, and sparkle trails on AI chat messages, making every interaction feel dramatic and cinematic.

### Acceptance Criteria
- 4.1 A `useParticleController` hook manages a queue of `ParticleEvent` objects and exposes `triggerExplosion`, `triggerDissolve`, and `triggerSparkle` methods that convert DOM coordinates to 3D world coordinates.
- 4.2 When clicking "Generate Plan", 500 particles explode outward from the button position in a radial burst, then coalesce into the positions of the resulting schedule blocks over ~1 second with easing.
- 4.3 When deleting a task or assignment (after confirmation), 300 particles spawn at the card's position and drift upward with turbulence while fading out over ~1.5 seconds, as the card simultaneously fades.
- 4.4 When the AI chat assistant responds, 50 sparkle particles trail along the message bubble with randomized offsets and a twinkle effect (opacity oscillation at ~3Hz) persisting for ~0.8 seconds.
- 4.5 All particles use GPU-instanced rendering (`THREE.InstancedMesh` or `THREE.Points` with `BufferGeometry`) to minimize draw calls, with a maximum buffer of 10,000 particles.
- 4.6 Particles respect physics: gravity, velocity damping (0.98/frame), and life drain. Dead particles (life ≤ 0) are removed each frame.
- 4.7 When `prefers-reduced-motion` is active, all particle effects are disabled.

## Requirement 5: Glassmorphism UI Panels

### User Story
As a user, I want all UI panels to have a frosted glass effect sitting on top of the 3D scene, creating a layered holographic interface aesthetic.

### Acceptance Criteria
- 5.1 A reusable `GlassmorphismPanel` component applies `backdrop-filter: blur()` (default 12px), semi-transparent background (rgba with configurable opacity), and a subtle rgba border to any wrapped content.
- 5.2 The Sidebar, ChatPanel, Modal, BlockDetail panel, and all page content containers use glassmorphism styling.
- 5.3 In light theme, panel background opacity is ≥ 0.6; in dark theme, ≥ 0.7 — ensuring text remains readable against the animated 3D background.
- 5.4 Glassmorphism blur, opacity, and border opacity are configurable via props on the `GlassmorphismPanel` component.
- 5.5 On browsers that do not support `backdrop-filter`, panels fall back to a solid semi-transparent background (no blur) using `@supports` CSS detection.

## Requirement 6: Animated Gradient Mesh Background

### User Story
As a user, I want a slowly morphing color gradient behind the 3D scene that shifts with the time of day, adding depth and atmosphere to the visual experience.

### Acceptance Criteria
- 6.1 A `GradientMeshBackground` component renders a full-viewport canvas at z-index layer 0 (behind the Three.js canvas).
- 6.2 The gradient uses 4+ color control points that animate with sinusoidal motion, creating a slowly morphing mesh effect.
- 6.3 Colors transition between four time-of-day palettes (morning: warm oranges/golds, afternoon: bright blues, evening: purples/pinks/oranges, night: deep blues/indigos) matching the 3D scene lighting.
- 6.4 Palette transitions are smooth, interpolating over 30-60 seconds when the time period changes.
- 6.5 The gradient mesh runs at 60fps using `requestAnimationFrame` with minimal GPU impact (simple 2D canvas or fragment shader).
- 6.6 The component is dynamically imported with `ssr: false`.
- 6.7 When `prefers-reduced-motion` is active, the gradient displays a static color matching the current time of day without animation.

## Requirement 7: 3D Floating Cards

### User Story
As a user, I want task and assignment cards in the Tasks view to float in 3D space with subtle rotation on hover, making the interface feel tangible and interactive.

### Acceptance Criteria
- 7.1 A `FloatingCard3D` component wraps task/assignment cards with CSS `perspective` and `transform-style: preserve-3d`.
- 7.2 On mouse hover, the card rotates on X and Y axes proportional to the mouse position relative to the card center, with a maximum rotation of ±15 degrees and configurable intensity.
- 7.3 Cards have a subtle continuous float animation (gentle vertical bobbing) using CSS keyframes with configurable amplitude and speed.
- 7.4 On mouse leave, the card smoothly returns to its neutral (flat) position using a spring-based CSS transition.
- 7.5 The depth shadow shifts direction based on the card's current rotation angle, enhancing the 3D illusion.
- 7.6 Cards use glassmorphism styling from `GlassmorphismPanel`.
- 7.7 When `prefers-reduced-motion` is active, hover rotation and float animation are disabled; cards remain flat.

## Requirement 8: Cinematic Loading Screen

### User Story
As a user, I want a dramatic 3D logo animation when the app first loads, where the word "COG" assembles from particles before the app is revealed.

### Acceptance Criteria
- 8.1 A `CinematicLoader` component renders a fullscreen R3F canvas on initial app load, before the main app UI is visible.
- 8.2 2000+ particles spawn at random positions in 3D space and converge to form the letters "COG" using target positions sampled from TextGeometry surfaces over ~2 seconds with spring physics.
- 8.3 The assembled logo holds for ~1 second with a subtle glow pulse effect.
- 8.4 The logo then explodes outward — particles burst radially and fade to transparent over ~0.5 seconds.
- 8.5 After the animation completes (~3.5 seconds total), the loader calls `onComplete`, triggering a fade-out of the loader and fade-in of the main app.
- 8.6 The `CinematicLoader` is dynamically imported with `ssr: false`.
- 8.7 If the loader fails to load (network error), the app reveals immediately without the animation.
- 8.8 When `prefers-reduced-motion` is active, the loader is skipped entirely and the app reveals immediately.

## Requirement 9: Adaptive Performance Management

### User Story
As a user, I want the 3D effects to automatically scale down on lower-end devices so the app remains usable and responsive regardless of hardware.

### Acceptance Criteria
- 9.1 The app monitors frame rate using `requestAnimationFrame` timing. If average FPS drops below 30 for 3 consecutive seconds, quality reduction begins.
- 9.2 Quality reduction follows a cascade: (1) disable post-processing, (2) reduce particle count by 50%, (3) reduce floating geometry count, (4) disable parallax, (5) fall back to static gradient background.
- 9.3 The current quality level is persisted in `localStorage` so returning visits start at the appropriate level without re-detecting.
- 9.4 On WebGL context loss, a "3D effects paused" indicator appears. Context restoration is attempted up to 3 times. On failure, the app falls back to 2D-only mode.
- 9.5 On mobile/touch devices, particle counts are reduced by 75%, post-processing is disabled, and mouse parallax is replaced with no-op.
- 9.6 All Three.js geometries, materials, and textures are properly disposed on component unmount via `useEffect` cleanup to prevent memory leaks.
- 9.7 The total GPU budget targets ≤ 500 draw calls, ≤ 100K triangles, and ≤ 10K active particles simultaneously.

## Requirement 10: SSR Safety and Dynamic Imports

### User Story
As a developer, I want all Three.js components to be safely isolated from server-side rendering so the Next.js 15 app builds and hydrates without errors.

### Acceptance Criteria
- 10.1 Every component that imports from `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, or `@react-spring/three` is exported as a dynamic import via `next/dynamic` with `{ ssr: false }`.
- 10.2 No Three.js-related code executes during server-side rendering — all such code is guarded by `typeof window !== 'undefined'` checks or isolated in client-only dynamic components.
- 10.3 Dynamic imports include a loading fallback (e.g., a simple CSS gradient or skeleton) so the UI is not blank while Three.js chunks load.
- 10.4 The Three.js bundle is code-split from the main application bundle, loading asynchronously after initial HTML/CSS paint.
