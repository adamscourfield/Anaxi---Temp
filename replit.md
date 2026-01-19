# Anaxi - Teacher Observation Platform

## Overview
Anaxi is a professional teacher observation and development platform designed for schools. Its primary purpose is to facilitate peer observations using custom rubrics, provide structured feedback through habit-based checklists, and track professional development for educators. The platform supports multiple schools with distinct role-based workflows for observers and teachers. Key capabilities include a robust user archiving system, comprehensive password reset functionality, department management, granular observation view permissions, academic year rubric management with scheduled activation, and a comprehensive Behaviour Management System for tracking incidents with real-time notifications and analytics. The system consolidates teachers and users into a single entity to streamline data management and supports multi-school assignments.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React, TypeScript, and Vite. UI and styling leverage shadcn/ui, Radix UI primitives, and Tailwind CSS, featuring a warm gradient design and light/dark mode. Client-side routing is managed by Wouter, and server state by TanStack Query. Authentication and school-specific data are handled via custom React hooks, adhering to a component-based design with compound components. Meeting functionalities, including conversations, are implemented with filtering capabilities.

### Backend
The backend is a Node.js application using Express and TypeScript, exposing a RESTful API. It utilizes PostgreSQL-backed session management and email/password-based authentication with bcrypt hashing and secure sessions. Role-based access control (Teacher, Leader, Admin, Creator) is enforced, and new user onboarding is email-based. The system supports a multi-school architecture with data isolation. Core data models include users, schools, school_memberships, departments, observation_view_permissions, students, and oncalls. Departments are school-scoped, and Observation View Permissions provide granular access. A Behaviour Management feature, including student and incident tracking, is feature-flagged per school with granular permissions.

### Data Architecture
Drizzle ORM manages interactions with a Neon serverless PostgreSQL database. The schema uses Zod for type-safe validation, and Drizzle Kit for migrations. `@neondatabase/serverless` is used for connection pooling.

### Object Storage
Replit Object Storage (Google Cloud Storage) is integrated via `ObjectStorageService`. An `ObjectAcl.ts` framework handles owner-based permissions and public/private visibility. File uploads are managed by `ObjectUploader.tsx` with authenticated uploads and ACL checks.

### Design System
The design system uses a Microsoft Forms-inspired sage/teal color scheme with glassmorphism effects. Key characteristics:
- **Color palette**: Soft sage/mint backgrounds (HSL 155), teal green accents for buttons and interactive elements
- **Gradients**: Emerald/teal/cyan gradient backgrounds with transparency
- **Glass effects**: Semi-transparent cards and sidebar with backdrop-blur
- **Cards**: Clean white with subtle shadows for contrast
- **Dark mode**: Dark teal/green tinted backgrounds with preserved glass effects
- CSS-based hover/active states, custom variables, a shadow system, comprehensive button and badge variants, and a mobile-first responsive approach.

### Feature Flag System
Major features are feature-flagged per school via an `enabled_features` array on the `schools` table. Available flags include `observations`, `meetings`, `absence_management`, and `behaviour`. The UI and API routes adapt based on these flags, ensuring modularity and controlled feature rollout.

### Flexible Dashboard
The dashboard dynamically adjusts its widgets and content based on enabled school features and user permissions, offering personalized greetings, feature-specific data summaries (e.g., observations, meetings, leave, behaviour), upcoming birthday alerts, and a summary of assigned action items.

### Behaviour Management System
This comprehensive system tracks student incidents with real-time notifications and analytics. It includes student record management (with CSV import), on-call incident logging with status workflows and email notifications, and an analytics dashboard with various visualizations and filtering options. Access is controlled via the `canManageBehaviour` permission on school memberships.

### Observation Analytics
A dedicated analytics page provides insights into teacher observations, accessible to Leaders, Admins, and Creators. Features include summary cards, trend charts, top/lowest performer lists, category and habit performance breakdowns, common phrase analysis from feedback, and time period filtering. A period comparison feature allows for comparing performance between two distinct timeframes.

### Period Comparison Feature
- **Location**: Analytics page (`/analytics`) with "Compare Periods" toggle
- **Access**: Leaders, Admins, and Creators only
- **Features**:
  - Two date range pickers (Period A = baseline, Period B = comparison)
  - Summary cards with observation counts and score deltas
  - Category performance comparison with visual bars and percentage changes
  - Habit performance comparison sorted by magnitude of change
  - **Teacher Performance Comparison**: Expandable rows showing each teacher's progress with:
    - Observation count changes between periods
    - Average score changes with directional badges
    - Top 3 improvements and top 3 declines by category
    - Teachers sorted by change magnitude (biggest changes first)
- **API Endpoint**: GET `/api/observation-comparison`
- **Key Features**:
  - Union-based delta calculation ensures all items from both periods are compared
  - Per-teacher metrics with category-level breakdowns for coaching insights

### Birthday Tracking
The platform tracks birthdays for both staff and students, with corresponding fields in `users` and `students` tables. API endpoints are available to retrieve upcoming birthdays, and access to this information is restricted to Leaders, Admins, and Creators.

## External Dependencies

### Core Framework
- React 18
- TypeScript
- Vite
- Express
- Drizzle ORM

### Database & Storage
- @neondatabase/serverless
- connect-pg-simple

### UI Components
- Radix UI
- shadcn/ui
- Tailwind CSS
- class-variance-authority
- cmdk
- embla-carousel-react

### Form & Data Management
- React Hook Form
- Zod
- TanStack Query
- date-fns
- date-fns-tz

### Email Notifications
- Resend

### Typography & Assets
- Lufga Font (CDN)
- Lucide React