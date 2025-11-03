# Anaxi - Teacher Observation Platform

## Overview
Anaxi is a professional teacher observation and development platform designed for schools. Its core purpose is to facilitate peer observations using custom rubrics, provide structured feedback through habit-based checklists, and track professional development for educators. The platform supports multiple schools, offering role-based workflows for observers and teachers, with a strong emphasis on clarity and efficiency. The consolidation of teachers and users into a single user entity streamlines data management and enhances support for multi-school assignments. Recent advancements include a robust user archiving system, comprehensive password reset functionality, **department management** with department-specific meetings to ensure action carryover works correctly between meetings, and **granular observation view permissions**. Departments (e.g., Maths, Science, English) are managed at the school level by Admins and Creators, enabling proper organization of department meetings with action tracking.

## Recent Changes (November 2025)
- **Comprehensive Meeting Details Page**: Created dedicated page at `/meetings/:id` for viewing complete meeting information. Clicking the Eye icon now navigates to a full-page view showing meeting metadata (type, date, organizer, department), full meeting notes, attendees list with roles and attendance status, and action items with assignees and due dates. Enhanced backend endpoints to return enriched data with names and roles.
- **Meeting Attendees Feature Complete**: Fixed critical bugs preventing meeting attendees from being saved. Root cause was `requireFeature` middleware unable to extract schoolId from parent meeting when creating sub-resources. Updated middleware to check parent resources for all HTTP methods. Fixed CommandItem navigation bug by using teacher ID as value with keywords prop for search. Attendees now save correctly and display in meetings table.
- **Leave Requests Fix**: Fixed leave request submission by converting ISO date strings to Date objects before Zod validation. The frontend sends dates as ISO strings, but the backend schema expects Date objects, so the conversion now happens automatically on the server.
- **Observation Table View**: Converted observation displays from cards to tables with columns for Teacher, Observer, Date, Score (progress bar 0-100%), Categories (badges), Class, and View icon. Search functionality filters by teacher and observer names.
- **Observation Scoring Fix**: Fixed observation details to show only categories actually used in the observation (not all rubric categories), ensuring scores accurately reflect observed habits.
- **Meetings Page - Teacher Names**: Fixed dropdown menus on meetings page to show full teacher names instead of just roles. Updated `/api/schools/:schoolId/memberships` endpoint to include user data (first_name, last_name, email).
- **Security Enhancements**: Implemented global `sanitizeUser()` function across all user-related API endpoints to prevent sensitive data leakage.
- **Email-Based Onboarding**: New users receive welcome emails with secure 7-day password setup links.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with **React** and **TypeScript**, utilizing **Vite** for tooling. **shadcn/ui** with **Radix UI** primitives and **Tailwind CSS** define the UI/Styling, featuring a warm gradient design, enhanced card shadows, and light/dark mode. **Wouter** handles client-side routing. **TanStack Query** manages server state, complemented by React hooks for local state. Authentication state is managed via `use-auth.tsx`, school-specific data with `use-school-data.tsx`, and current school context through `use-school.tsx`. The design adheres to a component-based pattern, leveraging compound components and custom hooks for shared logic.

### Backend
The backend runs on **Node.js** with **Express** and **TypeScript**, exposing a **RESTful API** (`/api` prefix). Storage is abstracted with an `IStorage` interface, designed for database integration. **PostgreSQL-backed session management** uses `connect-pg-simple`. Authentication is email/password-based with **bcrypt hashing** (10 salt rounds) and secure session configuration, implementing role-based access control (Teacher, Leader, Admin, Creator). Public registration is disabled; teacher accounts are created by administrators only. **New user onboarding** uses an email-based password setup flow: administrators create user accounts without passwords, the system generates a secure 7-day token and sends a welcome email with a password setup link, and users complete registration by setting their own password. The system supports a **multi-school architecture** with data isolation, where the `Creator` role manages schools platform-wide, and regular users access data relevant to their assigned schools. `users`, `schools`, `school_memberships`, `departments`, `observation_view_permissions`, and `password_setup_token` fields form the core data models. Teachers are now integrated as users with school memberships, simplifying the data model. **Departments** are school-scoped entities managed by Admins/Creators with full CRUD operations via `/api/schools/:schoolId/departments` endpoints. **Observation View Permissions** implement granular access control: Creators see all observations, Admins see all observations in their schools, and Leaders/Teachers only see observations for teachers they have explicit permission to view (plus their own observations). Permissions are managed by Admins/Creators via the "Manage Observations" interface in the teacher management page. **App Management** is accessible to both Admin and Creator roles, allowing Admins to manage school-level settings and features while Creators manage platform-wide schools.

### Data Architecture
**Drizzle ORM** is used for PostgreSQL interactions, connected to a **Neon serverless database**. The schema is defined with type-safety using **Zod validation**. **@neondatabase/serverless** provides connection pooling, and **Drizzle Kit** is employed for schema migrations.

### Object Storage
**Replit Object Storage** (Google Cloud Storage) is integrated via `ObjectStorageService`. An `ObjectAcl.ts` framework handles owner-based permissions and public/private visibility. File uploads, such as profile pictures, are managed by `ObjectUploader.tsx` (Uppy-based), with authenticated uploads and ACL checks for downloads.

### Design System
The design system is based on a warm gradient foundation (peachy/salmon to white), featuring elevated card designs, professional warmth, and a clear data hierarchy. It incorporates CSS-based hover/active states, custom variables, a shadow system, comprehensive button and badge variants, and a mobile-first responsive approach.

## External Dependencies

### Core Framework
- **React 18**: UI library.
- **TypeScript**: Type safety.
- **Vite**: Build tool.
- **Express**: Backend framework.
- **Drizzle ORM**: Database toolkit.

### Database & Storage
- **@neondatabase/serverless**: Serverless PostgreSQL client.
- **connect-pg-simple**: PostgreSQL session store.

### UI Components
- **Radix UI**: Headless UI primitives.
- **shadcn/ui**: Component library configuration.
- **Tailwind CSS**: Utility-first CSS.
- **class-variance-authority**: Variant management.
- **cmdk**: Command menu.
- **embla-carousel-react**: Carousel.

### Form & Data Management
- **React Hook Form**: Form state.
- **Zod**: Schema validation.
- **TanStack Query**: Server state management.
- **date-fns**: Date manipulation.

### Typography & Assets
- **Lufga Font**: Custom typography (CDN).
- **Lucide React**: Icon library.