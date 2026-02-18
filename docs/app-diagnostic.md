# Anaxi App Diagnostic (Codebase Orientation)

## 1) Architecture at a glance
- **Frontend**: React + Vite + Wouter + TanStack Query.
- **Backend**: Express + Drizzle ORM + PostgreSQL.
- **Monorepo layout**:
  - `client/` for UI pages/components.
  - `server/` for API/auth/storage.
  - `shared/schema.ts` for database schema and inferred types.

## 2) Route and layout model (UI shell)
- App routes are registered in `client/src/App.tsx` and include Dashboard, Observe, Meetings, Leave Requests, Behaviour, On-Call, management pages, and profile.
- The authenticated shell uses:
  - top header (logo, school selector, user menu, theme toggle)
  - left icon sidebar
  - central scrollable main content area
  - mobile bottom nav.

## 3) Design system reality (current implementation)
- The active theme is **token-driven** via CSS custom properties in `client/src/index.css`, with light and dark mode sets for semantic tokens like `--background`, `--primary`, `--muted`, `--card`, etc.
- Brand/action color emphasis is currently blue/purple (`--primary: 229 64% 56%`) with green-tinted background tokens in light mode (`--background: 155 20% 91%`).
- Border radius defaults are compact and tuned in Tailwind extension (`md: 6px`, `lg: 9px`), with shadow values driven from CSS variables.
- Fonts are set to **Lufga** globally via CSS variable and Tailwind font family mapping.

## 4) Navigation/icon language
- Sidebar module iconography is the source of truth for feature icon consistency:
  - Observe: `Eye`
  - Meetings: `MessageSquare`
  - Leave of Absence: `Calendar`
  - On-Call: `AlertCircle`
  - Behaviour Management: `ShieldAlert`
- New quick-actions should reuse these module icons where possible to preserve pattern recognition.

## 5) Database structure orientation (core domains)
- **Identity / tenancy**: `users`, `schools`, `school_memberships`, `teaching_groups`.
- **Observations**: `rubrics`, `categories`, `habits`, `observations`, `observation_habits`, plus view permissions.
- **Meetings**: `meetings`, `meeting_attendees`, `meeting_actions`.
- **Leave**: `leave_requests`.
- **Behaviour**: `students`, `oncalls`.
- Schema includes role/permission flags in memberships (`canApproveAllLeave`, `canManageBehaviour`, `canViewAllObservations`) and school feature gating via `enabled_features`.

## 6) Functional style guidance for future UI/page creation
When adding new pages/components, align with these implementation patterns:
1. **Use semantic token classes** (`bg-card`, `text-muted-foreground`, `border-border`) instead of hardcoded colors, unless matching an existing branded control.
2. **Use existing shadcn/ui primitives** from `client/src/components/ui/*` and compose from `Card`, `Badge`, `Button`, `DropdownMenu`, `Dialog`, etc.
3. **Follow spacing rhythm** already common in pages: `p-4 md:p-6`, `gap-3/4/6`, section blocks with rounded cards.
4. **Use feature-gated rendering** based on `currentSchool.enabled_features` and membership permissions.
5. **Prefer icon consistency** with sidebar module mappings.
6. **Preserve dark mode** by avoiding fixed light-only colors unless intentionally branded.

## 7) Diagnostics run in this pass
- `npm run check` reports substantial pre-existing TypeScript issues across client/server (route prop typing, stale schema/type references, implicit anys, and storage interface drift).
- `npm run build` succeeds, but emits warnings:
  - outdated Browserslist DB
  - PostCSS plugin `from` warning
  - large JS chunk warning (`~1.58MB` main bundle)

## 8) Priority technical debt backlog (recommended)
1. **Type-safety restoration**: clear `npm run check` failures (highest impact for safe iteration).
2. **Bundle splitting**: reduce large main chunk using dynamic imports/manual chunks.
3. **Theme coherence pass**: reconcile legacy design doc language vs implemented green/blue token system and update docs to reflect current canonical style.
4. **UI consistency audit**: normalize custom one-off class overrides back to tokenized styles where possible.
