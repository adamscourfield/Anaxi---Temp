# Anaxi - Teacher Observation Platform

## Overview
Anaxi is a professional teacher observation and development platform designed for schools. Its core purpose is to facilitate peer observations using custom rubrics, provide structured feedback through habit-based checklists, and track professional development for educators. The platform supports multiple schools, offering role-based workflows for observers and teachers, with a strong emphasis on clarity and efficiency. The consolidation of teachers and users into a single user entity streamlines data management and enhances support for multi-school assignments. Recent advancements include a robust user archiving system, comprehensive password reset functionality, **department management** with department-specific meetings to ensure action carryover works correctly between meetings, and **granular observation view permissions** allowing fine-grained control over who can view which teachers' observations. Departments (e.g., Maths, Science, English) are managed at the school level by Admins and Creators, enabling proper organization of department meetings with action tracking.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with **React** and **TypeScript**, utilizing **Vite** for tooling. **shadcn/ui** with **Radix UI** primitives and **Tailwind CSS** define the UI/Styling, featuring a warm gradient design, enhanced card shadows, and light/dark mode. **Wouter** handles client-side routing. **TanStack Query** manages server state, complemented by React hooks for local state. Authentication state is managed via `use-auth.tsx`, school-specific data with `use-school-data.tsx`, and current school context through `use-school.tsx`. The design adheres to a component-based pattern, leveraging compound components and custom hooks for shared logic.

### Backend
The backend runs on **Node.js** with **Express** and **TypeScript**, exposing a **RESTful API** (`/api` prefix). Storage is abstracted with an `IStorage` interface, designed for database integration. **PostgreSQL-backed session management** uses `connect-pg-simple`. Authentication is email/password-based with **bcrypt hashing** (10 salt rounds) and secure session configuration, implementing role-based access control (Teacher, Leader, Admin, Creator). Public registration is disabled; teacher accounts are created by administrators only. The system supports a **multi-school architecture** with data isolation, where the `Creator` role manages schools platform-wide, and regular users access data relevant to their assigned schools. `users`, `schools`, `school_memberships`, `departments`, and `observation_view_permissions` form the core data models. Teachers are now integrated as users with school memberships, simplifying the data model. **Departments** are school-scoped entities managed by Admins/Creators with full CRUD operations via `/api/schools/:schoolId/departments` endpoints. **Observation View Permissions** implement granular access control: Creators see all observations, Admins see all observations in their schools, and Leaders/Teachers only see observations for teachers they have explicit permission to view (plus their own observations). Permissions are managed by Admins/Creators via the "Manage Observations" interface in the teacher management page.

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