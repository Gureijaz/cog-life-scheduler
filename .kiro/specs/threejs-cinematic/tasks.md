# Tasks: Three.js Cinematic 3D Animations

- [ ] 1. Install dependencies and configure project
  - [x] 1.1 Add `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `framer-motion`, `@react-spring/three`, and `three-stdlib` to `frontend/package.json` dependencies and run install
  - [-] 1.2 Update `frontend/next.config.ts` to transpile Three.js packages if needed and configure webpack for GLSL shader imports
  - [ ] 1.3 Create `frontend/src/components/three/` directory structure for all 3D components

- [ ] 2. Implement core hooks
  - [ ] 2.1 Create `frontend/src/hooks/useTimeOfDay.ts` — detects current time period (morning/afternoon/evening/night), returns `timeOfDay`, interpolated `LightingState`, and `progress` within period; re-evaluates on configurable interval; defines `LIGHTING_PRESETS` and `TIME_GRADIENTS` constants (Req 1.4, 6.3)
  - [ ] 2.2 Create `frontend/src/hooks/useMouseParallax.ts` — tracks normalized mouse position [-1,1], applies exponential smoothing, returns bounded offset `{x, y}`; respects `prefers-reduced-motion` by returning zero; uses `requestAnimationFrame` batching (Req 1.6, 1.8)
  - [ ] 2.3 Create `frontend/src/hooks/useCinematicNavigation.ts` — defines `PAGE_CAMERA_POSITIONS` map, exposes `currentRoute`, `cameraTarget`, `isTransitioning`, and `navigateTo(route)` that coordinates spring camera animation with Next.js router push; respects `prefers-reduced-motion` for instant cuts (Req 2.1, 2.4, 2.5, 2.6)
  - [ ] 2.4 Create `frontend/src/hooks/useParticleController.ts` — manages `ParticleEvent[]` queue, exposes `triggerExplosion(origin, color, targets?)`, `triggerDissolve(bounds, color)`, `triggerSparkle(path, color)`, and `clearCompleted()`; converts DOM coordinates to 3D world coordinates via `screenToWorld` utility; respects `prefers-reduced-motion` (Req 4.1, 4.7)
  - [ ] 2.5 Create `frontend/src/hooks/useAdaptiveQuality.ts` — monitors FPS via `requestAnimationFrame` timing, implements quality cascade (disable post-processing → reduce particles → reduce geometries → disable parallax → static fallback), persists quality level in `localStorage`, detects mobile/touch devices (Req 9.1, 9.2, 9.3, 9.5)

- [ ] 3. Implement Gradient Mesh Background
  - [ ] 3.1 Create `frontend/src/components/three/GradientMeshBackground.tsx` — full-viewport canvas at z-index 0, animates 4+ color control points with sinusoidal motion, interpolates between time-of-day palettes over 30-60s, runs at 60fps via `requestAnimationFrame`; static fallback for `prefers-reduced-motion` (Req 6.1, 6.2, 6.3, 6.4, 6.5, 6.7)
  - [ ] 3.2 Create dynamic export wrapper `frontend/src/components/three/DynamicGradientMesh.tsx` using `next/dynamic` with `ssr: false` and a CSS gradient loading fallback (Req 6.6, 10.1, 10.3)

- [ ] 4. Implement Persistent 3D Background Scene
  - [ ] 4.1 Create `frontend/src/components/three/FloatingGeometries.tsx` — procedurally generates 15+ geometries (icosahedron, octahedron, torus, torusKnot, dodecahedron) distributed within spread radius, each wrapped in drei `<Float>` with individual rotation speeds, wireframe/translucent emissive materials matching time-of-day palette (Req 1.2)
  - [ ] 4.2 Create `frontend/src/components/three/CinematicCamera.tsx` — spring-physics camera rig using `@react-spring/three`, interpolates position/lookAt to `cameraTarget` from `useCinematicNavigation`, applies additive mouse parallax offset from `useMouseParallax`, configurable spring stiffness/damping/mass (Req 2.2, 1.6)
  - [ ] 4.3 Create `frontend/src/components/three/SceneCanvas.tsx` — root `<Canvas>` component spanning full viewport with `pointer-events: none`, composes FloatingGeometries, CinematicCamera, drei `<Stars>` (opacity from timeOfDay), ambient/directional lights from `LightingState`, and post-processing stack (Bloom half-res, ChromaticAberration, Vignette); accepts `timeOfDay`, `mousePosition`, `currentRoute`, `particleEvents` props (Req 1.1, 1.3, 1.4, 1.5)
  - [ ] 4.4 Create dynamic export wrapper `frontend/src/components/three/DynamicSceneCanvas.tsx` using `next/dynamic` with `ssr: false` and transparent loading fallback (Req 1.7, 10.1, 10.3)

- [ ] 5. Implement Particle System
  - [ ] 5.1 Create `frontend/src/components/three/ParticleSystem.tsx` — GPU-instanced particle renderer using `THREE.Points` with `BufferGeometry` (max 10K buffer), processes `ParticleEvent` queue each frame: spawns particles, applies phase-based physics (burst/coalesce/dissolve/sparkle), integrates position, drains life, removes dead particles; calls `onEventComplete` when all particles for an event are dead (Req 4.5, 4.6)
  - [ ] 5.2 Create `frontend/src/lib/particlePhysics.ts` — pure functions: `updateParticles(particles, deltaTime, config)`, `spawnExplosion(origin, count, speed)`, `spawnDissolution(bounds, count)`, `spawnSparkle(path, count)` with formal preconditions/postconditions as documented in design (Req 4.2, 4.3, 4.4)
  - [ ] 5.3 Create `frontend/src/lib/screenToWorld.ts` — utility function converting screen pixel coordinates to Three.js world coordinates given camera and target depth (Req 4.1)

- [ ] 6. Implement Cinematic Loading Screen
  - [ ] 6.1 Create `frontend/src/components/three/CinematicLoader.tsx` — fullscreen R3F canvas, generates "COG" letter target positions via TextGeometry surface sampling, spawns 2000+ particles at random positions, animates convergence (0-2s spring physics), hold with glow pulse (2-3s), explosion + fade (3-3.5s), calls `onComplete`; skipped entirely when `prefers-reduced-motion` active (Req 8.1, 8.2, 8.3, 8.4, 8.5, 8.8)
  - [ ] 6.2 Create dynamic export wrapper `frontend/src/components/three/DynamicCinematicLoader.tsx` using `next/dynamic` with `ssr: false`; if import fails, immediately calls `onComplete` to reveal app (Req 8.6, 8.7, 10.1)

- [ ] 7. Implement Glassmorphism UI System
  - [ ] 7.1 Create `frontend/src/components/three/GlassmorphismPanel.tsx` — reusable wrapper applying `backdrop-filter: blur()` (default 12px), semi-transparent rgba background, subtle rgba border; configurable blur, opacity, borderOpacity props; `@supports` fallback for browsers without `backdrop-filter` (Req 5.1, 5.4, 5.5)
  - [ ] 7.2 Add glassmorphism CSS custom properties and utility classes to `frontend/src/styles/globals.css` — define `--glass-blur`, `--glass-bg-light`, `--glass-bg-dark`, `--glass-border` tokens; light theme opacity ≥ 0.6, dark theme ≥ 0.7 (Req 5.3)
  - [ ] 7.3 Apply glassmorphism styling to Sidebar (`frontend/src/components/Sidebar.tsx`), ChatPanel (`frontend/src/components/chat/ChatPanel.tsx`), Modal (`frontend/src/components/ui/Modal.tsx`), and BlockDetail (`frontend/src/components/calendar/BlockDetail.tsx`) by wrapping or adding glassmorphism classes (Req 5.2)

- [ ] 8. Implement 3D Floating Cards
  - [ ] 8.1 Create `frontend/src/components/three/FloatingCard3D.tsx` — wrapper with CSS `perspective` and `transform-style: preserve-3d`, tracks mouse position relative to card center on hover, rotates X/Y axes (max ±15°, configurable intensity), continuous float keyframe animation (configurable amplitude/speed), spring-based return on mouse leave, depth shadow shifts with rotation; disabled when `prefers-reduced-motion` active (Req 7.1, 7.2, 7.3, 7.4, 7.5, 7.7)
  - [ ] 8.2 Update `frontend/src/app/tasks/page.tsx` to wrap each task card and assignment card in `FloatingCard3D` with glassmorphism styling (Req 7.6)

- [ ] 9. Implement 3D Schedule Visualization
  - [ ] 9.1 Create `frontend/src/components/three/ScheduleVisualization3D.tsx` — R3F scene rendering schedule blocks as 3D bars on 7×18 grid, `MeshStandardMaterial` with category-colored emissive (intensity 0.4), drei `<OrbitControls>` for rotate/zoom/pan, hover increases emissive to 0.8 + tooltip, click triggers `onBlockSelect`, wireframe grid lines with subtle glow (Req 3.2, 3.3, 3.4, 3.5, 3.6, 3.7)
  - [ ] 9.2 Create dynamic export wrapper `frontend/src/components/three/DynamicScheduleViz3D.tsx` using `next/dynamic` with `ssr: false` (Req 3.8, 10.1)
  - [ ] 9.3 Update `frontend/src/app/week/page.tsx` to add 2D/3D toggle button and conditionally render `DynamicScheduleViz3D` or existing `WeekGrid` based on toggle state (Req 3.1)

- [ ] 10. Integrate into app layout and page transitions
  - [ ] 10.1 Update `frontend/src/app/layout.tsx` to integrate: `CinematicLoader` (shown until `onComplete`), `DynamicGradientMesh`, `DynamicSceneCanvas` (persistent behind UI), wrap `{children}` in Framer Motion `<AnimatePresence mode="wait">` with fade+scale `<motion.div>`, use `useCinematicNavigation` for camera coordination, `useTimeOfDay` for lighting/gradient, `useMouseParallax` for parallax, `useParticleController` for particle events (Req 1.1, 2.3, 8.5)
  - [ ] 10.2 Update `frontend/src/app/page.tsx` (Today) to wire "Generate Plan" button to `triggerExplosion` from `useParticleController` on click, passing button DOMRect and primary color; after schedule result arrives, trigger coalesce to block positions (Req 4.2)
  - [ ] 10.3 Update `frontend/src/app/tasks/page.tsx` to wire delete confirmation to `triggerDissolve` from `useParticleController`, passing card DOMRect and category color (Req 4.3)
  - [ ] 10.4 Update `frontend/src/components/chat/ChatPanel.tsx` to wire AI response messages to `triggerSparkle` from `useParticleController`, passing message bubble path and accent color (Req 4.4)

- [ ] 11. Implement adaptive performance and WebGL error handling
  - [ ] 11.1 Integrate `useAdaptiveQuality` into `SceneCanvas` — pass quality level to control post-processing toggle, particle count multiplier, geometry count, and parallax enable/disable; apply quality cascade on FPS drop (Req 9.1, 9.2, 9.7)
  - [ ] 11.2 Add WebGL context loss/restore handling to `SceneCanvas` — listen for `webglcontextlost`/`webglcontextrestored` events, show "3D effects paused" indicator, attempt restoration up to 3 times, fall back to 2D-only on failure (Req 9.4)
  - [ ] 11.3 Add `useEffect` cleanup to all Three.js components to dispose geometries, materials, and textures on unmount (Req 9.6)
