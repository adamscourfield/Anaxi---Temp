# Anaxi - Teacher Observation Platform

## Overview
Anaxi is a professional teacher observation and development platform for schools. It enables educators to conduct peer observations using custom rubrics, provide structured feedback via habit-based checklists, and track professional development. The platform supports multiple schools with role-based workflows for observers and teachers, focusing on clarity and efficiency.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Technology**: React with TypeScript, Vite.
- **UI/Styling**: shadcn/ui with Radix UI primitives, Tailwind CSS with a warm gradient design (peachy/salmon to white), enhanced card shadows, light/dark mode support. Custom Lufga font.
- **Routing**: Wouter for client-side routing.
- **State Management**: TanStack Query for server state, React hooks for local state.
- **Authentication State**: `use-auth.tsx` for user/creator status, `use-school-data.tsx` for school-specific data, and `use-school.tsx` for current school context.
- **Design Patterns**: Component-based, compound components, custom hooks for shared logic.

### Backend
- **Technology**: Node.js with Express, TypeScript.
- **API**: RESTful API (`/api` prefix).
- **Storage**: Abstracted storage interface (`IStorage`) with in-memory implementation for development, designed for database integration.
- **Session Management**: PostgreSQL-backed session management using `connect-pg-simple`.
- **Authentication**: Email/password with bcrypt hashing (10 salt rounds), secure session configuration, role-based access control (Teacher, Leader, Admin, Creator). Public registration removed; admin-only teacher account creation.
- **Multi-School Architecture**: Supports multiple schools with data isolation. `Creator` role manages schools platform-wide. Regular users access only their school data. Data models include `users`, `schools`, `school_memberships`.
- **Dashboard**: Real-time stats and analytics scoped to the current school, dynamically fetched from the database.

### Data Architecture
- **ORM**: Drizzle ORM for PostgreSQL (Neon serverless database).
- **Schema**: Type-safe schema definitions with Zod validation.
- **Connection**: Connection pooling via `@neondatabase/serverless`.
- **Migrations**: Drizzle Kit for schema migrations.

### Object Storage
- **Integration**: Replit Object Storage (Google Cloud Storage) via `ObjectStorageService`.
- **ACL Framework**: `ObjectAcl.ts` for owner-based permissions and public/private visibility.
- **Uploader**: `ObjectUploader.tsx` (Uppy-based) for file uploads (e.g., profile pictures).
- **Security**: Authenticated uploads, public visibility for profile pictures, ACL checks for downloads.

### Design System
- **Principles**: Warm gradient foundation, elevated card design, professional warmth, clear data hierarchy.
- **Background**: Radial gradient (peachy/salmon to white).
- **Elevation**: CSS-based hover/active states with custom variables and shadow system (shadow-sm, shadow-md).
- **Components**: Comprehensive button and badge variants.
- **Responsiveness**: Mobile-first approach.

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