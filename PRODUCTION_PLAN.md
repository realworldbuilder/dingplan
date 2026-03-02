# DingPlan Production Plan

## User Journey Audit (as a new user)

### What works:
- ✅ Canvas Gantt renders with swimlanes + tasks
- ✅ Add tasks, drag to resize/move
- ✅ Dependencies (FS links)
- ✅ Trade-based swimlanes with colors
- ✅ AI Composer (GPT function-calling to generate schedules)
- ✅ XER export (P6 format)
- ✅ XER import (548 lines, solid)
- ✅ PDF export (jsPDF + html2canvas)
- ✅ JSON export + share link (base64 URL)
- ✅ Supabase auth (email/password + Google OAuth)
- ✅ Cloud project storage with RLS
- ✅ 16 WBS templates (commercial, residential, industrial, healthcare, etc.)
- ✅ Touch manager for mobile
- ✅ localStorage fallback for anonymous users

### What's broken / rough:
1. **Auth modal blocks everything on first load** — user sees "Welcome to DingPlan" over a blank gray page. No sense of what the app IS before signing up. Why would I sign up?
2. **"Continue without account" is tiny and buried** — should be primary action, auth should be optional
3. **No onboarding** — new user gets empty canvas with no guidance
4. **No landing/hero content** — it's just a gray canvas with a hamburger. Need to show value.
5. **Sidebar "Saves to your browser — no account needed" banner is wrong if logged in**
6. **Settings page exposes raw API key input** — logged-in users shouldn't see this
7. **No favicon** — uses logo.png but that's the flame logo, not an .ico
8. **No loading state** — blank flash before canvas renders
9. **Mobile is untested** — TouchManager exists but layout probably breaks
10. **No error boundaries** — if Supabase is down, app should still work offline

---

## The Plan: Ship DingPlan v1.0

### PHASE A: First Impression (do first — this is why nobody converts)

#### A1. Kill the auth gate on first visit
- App loads directly into the canvas with a sample project
- Small "Sign in" button in top-right corner
- Auth modal only shows when user clicks "Sign in" or tries to save to cloud
- "Continue without account" becomes the DEFAULT, not the escape hatch

#### A2. Welcome experience with sample project  
- New users land on a pre-loaded demo schedule ("Tenant Improvement — Suite 200")
- ~15 tasks across 4 swimlanes showing what DingPlan can do
- Toast/banner: "This is a sample project. Click + New to start your own."
- Shows dependencies, trade colors, realistic durations

#### A3. Quick-start templates
- After clicking "+ New", show template picker (not empty canvas)
- Grid of template cards: Residential, Commercial, TI, MEP, Sitework, Healthcare, Data Center, Blank
- Each card shows task count, duration, and a mini preview
- Selecting one populates the canvas immediately

#### A4. Polish the auth modal
- Add DingPlan logo at top
- Better copy: "Save to cloud, access anywhere" not "Welcome to DingPlan"
- Google OAuth should be the primary big button (lowest friction)
- Email/password below as secondary
- Show a subtle "What is DingPlan?" link to a one-liner

### PHASE B: Core UX Polish

#### B1. Top toolbar bar
- Replace floating hamburger with a proper top bar (48px)
- Left: hamburger (opens sidebar) + project name (editable)
- Center: view controls (zoom in/out, fit to screen, go to today)
- Right: user avatar/sign-in + share button + export dropdown
- This is how every real app works (Figma, Notion, Linear)

#### B2. Smart sidebar state
- "Saves to browser" banner → context-aware: show "Synced to cloud ✓" if logged in
- Hide API key settings section for logged-in users
- Add "Your Projects" section showing cloud projects when logged in

#### B3. Empty states everywhere
- Empty swimlane: "Drag a task here or click + Add Task"
- No dependencies: "Click 🔗 Dependencies in sidebar to link tasks"
- No tasks: show the template picker

#### B4. Keyboard shortcuts
- Ctrl+Z / Cmd+Z: undo
- Delete/Backspace: delete selected task
- Ctrl+S: force save
- Ctrl+N: new task
- Space: pan mode
- Show shortcuts in a "?" help panel

#### B5. Undo/Redo
- Critical for any editor — even basic single-level undo

### PHASE C: Export & Interop (the P6 killer features)

#### C1. PDF export improvements
- Landscape orientation, fit-to-page
- Include project name, date, legend
- Company logo/name option
- Lookahead view (2-week filtered PDF)

#### C2. XER import polish
- Progress indicator for large files
- Preview imported tasks before committing
- Handle XER edge cases (calendars, resources, notebooks)

#### C3. Share improvements
- Share as read-only link (viewer mode, no edit)
- Share as editable copy
- Download as .dingplan file (JSON with metadata)

### PHASE D: Critical Path (the real differentiator)

#### D1. CPM Engine
- Forward pass: calculate early start/early finish
- Backward pass: calculate late start/late finish
- Total float = LS - ES
- Free float = min(ES of successors) - EF
- Support all 4 relationship types (FS, SS, FF, SF) with lag

#### D2. Visual critical path
- Red highlight on critical path tasks (float = 0)
- Toggle on/off in toolbar
- Float values shown in task details panel

#### D3. Auto-scheduling
- "Schedule" button: recalculates all dates based on dependencies
- Respects constraints (must-start-on, no-earlier-than)
- Shows conflicts/violations

### PHASE E: Production Hardening

#### E1. Error handling
- Supabase offline → graceful fallback to localStorage with "Offline mode" indicator
- API key invalid → clear error message
- XER parse failure → show what went wrong

#### E2. Performance
- Virtual rendering for 500+ tasks (only render visible rows)
- Debounce auto-save
- Lazy-load AI Composer (it pulls in OpenAI SDK)

#### E3. Mobile responsive
- Sidebar as bottom sheet on mobile
- Pinch-to-zoom on canvas
- Task details as modal on tap
- Test on iPhone Safari + Android Chrome

#### E4. Analytics
- Plausible or PostHog (privacy-friendly)
- Track: sign-ups, template usage, exports, AI composer usage
- Need this to know what features matter

#### E5. SEO & marketing page
- dingplan.com should have a real landing page (not just the app)
- /app route for the actual tool
- Landing: hero, features, "free forever" badge, screenshots, CTA
- Or: keep app at root, add /about for marketing

---

## Execution Order

**Week 1: First Impression**
- A1 (kill auth gate) + A2 (sample project) + A3 (template picker) — this is the difference between 0% and 30% retention

**Week 2: Top Bar + Polish**  
- B1 (toolbar) + B2 (smart sidebar) + B4 (keyboard shortcuts) — feels like a real app

**Week 3: Critical Path**
- D1 (CPM engine) + D2 (visual critical path) — this is THE feature that makes subs switch from Excel

**Week 4: Ship & Share**
- C1 (PDF polish) + C3 (share improvements) + E4 (analytics) + E5 (landing page)

---

## Success Metrics
- User signs up within 60 seconds of landing
- Creates first task within 2 minutes
- Exports PDF or XER within first session
- Comes back within 7 days
