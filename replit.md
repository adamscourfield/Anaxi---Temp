# Anaxi - Teacher Observation Platform

## Overview
Anaxi is a professional teacher observation and development platform for schools. It facilitates peer observations using custom rubrics, provides structured feedback via habit-based checklists, and tracks professional development for educators. The platform supports multiple schools with role-based workflows for observers and teachers, emphasizing clarity and efficiency. Key features include a robust user archiving system, comprehensive password reset functionality, department management with associated meetings, granular observation view permissions, academic year rubric management with scheduled activation and roll-forward capabilities, and a comprehensive **Behaviour Management System** for incident tracking with real-time email notifications and analytics. The system is designed to streamline data management by consolidating teachers and users into a single entity, supporting multi-school assignments.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses **React** with **TypeScript** and **Vite**. UI/Styling is built with **shadcn/ui**, **Radix UI** primitives, and **Tailwind CSS**, featuring a warm gradient design and light/dark mode. **Wouter** handles client-side routing, while **TanStack Query** manages server state. Authentication and school-specific data are managed via custom React hooks. The design follows a component-based pattern with compound components and custom hooks.

#### Meetings Page Features (Updated)
- **Conversation Filter**: Filter meetings by type including "Conversations" (meetings with type="Conversation")
- **User/Attendee Filter**: Filter meetings by involvement of a particular person with searchable dropdown (searches by first name, last name, or email)
- **Conversations**: Now implemented as meetings with type="Conversation" instead of using deprecated conversations table with rating field
- **Rating Removed**: Rating functionality completely removed from conversation creation flow
- **Known Issue**: Backend validation should be enhanced to ensure conversations always have attendees (currently relies on frontend validation)

### Backend
The backend is a **Node.js** application with **Express** and **TypeScript**, exposing a **RESTful API**. It uses **PostgreSQL-backed session management** via `connect-pg-simple`. Authentication is email/password-based with **bcrypt hashing** and secure session configuration, implementing role-based access control (Teacher, Leader, Admin, Creator). Public registration is disabled; new user onboarding is email-based with secure password setup links. The system supports a **multi-school architecture** with data isolation. Core data models include `users`, `schools`, `school_memberships`, `departments`, `observation_view_permissions`, `password_setup_token`, `students`, and `oncalls`. Departments are school-scoped entities with CRUD operations. **Observation View Permissions** provide granular access control based on user roles and school assignments. **Behaviour Management** is feature-flagged per school with granular `canManageBehaviour` permission at the membership level.

### Data Architecture
**Drizzle ORM** manages interactions with a **Neon serverless PostgreSQL database**. The schema is defined with type-safety using **Zod validation**, and **Drizzle Kit** is used for migrations. `@neondatabase/serverless` provides connection pooling.

### Object Storage
**Replit Object Storage** (Google Cloud Storage) is integrated via `ObjectStorageService`. An `ObjectAcl.ts` framework handles owner-based permissions and public/private visibility. File uploads are managed by `ObjectUploader.tsx` (Uppy-based) with authenticated uploads and ACL checks for downloads.

### Design System
The design system features a warm gradient foundation (peachy/salmon to white), elevated card designs, and a clear data hierarchy. It includes CSS-based hover/active states, custom variables, a shadow system, comprehensive button and badge variants, and a mobile-first responsive approach.

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
- **date-fns-tz**: Timezone conversions (Europe/London for behaviour analytics).

### Email Notifications
- **Resend**: Email delivery service for on-call notifications.

### Typography & Assets
- **Lufga Font**: Custom typography (CDN).
- **Lucide React**: Icon library.

## Key Features

### Behaviour Management System
A comprehensive incident tracking system for schools with real-time notifications and analytics. **Feature-flagged per school** (`enabled_features` array includes "behaviour") with granular permission control (`canManageBehaviour` on memberships).

#### Student Management
- **Student Records**: Name, SEND status, Pupil Premium status, archive status
- **CRUD Operations**: Create, update, archive/unarchive students
- **CSV Import**: Bulk import with duplicate detection and automatic update
- **Access Control**: Restricted to users with `canManageBehaviour` permission
- **Data Isolation**: All student data is school-scoped

#### On-Call Incidents
- **Incident Tracking**: Location, description, student association, timestamps
- **Status Workflow**: Open → Completed with completion notes
- **Real-time Email Notifications**: Automatic emails to all behaviour-permission users in the school when an on-call is raised, including deep link to completion modal
- **Deep Linking**: URL parameter `?oncall_id=xyz` auto-opens completion modal
- **Status Filtering**: Filter on-calls by All, Open, or Completed with real-time count badges
- **Access Levels**: 
  - Raise On-Call: All users in behaviour-enabled schools
  - Manage/Complete: Only users with `canManageBehaviour` permission

#### Analytics Dashboard
- **Date Range Filtering**: Week, Month, Year, Custom
- **Europe/London Timezone**: All analytics calculations use Europe/London timezone for consistency
- **Visualizations**:
  - **On-Calls by Teacher**: Table showing completed on-calls per staff member
  - **Students with Most On-Calls**: Table with open/completed/total counts per student
  - **Time-of-Day Distribution**: Hourly histogram (0-23) showing when incidents occur
  - **Day-of-Week Distribution**: Weekly pattern analysis (Monday-Sunday)
- **Interactive Drill-Down**: All analytics elements are clickable to view detailed on-call information
  - Teacher rows: Show all completed on-calls by that teacher (filtered by userId)
  - Student rows: Show all on-calls for that student (filtered by studentId)
  - Time chart bars: Show on-calls that occurred during that hour (Europe/London timezone)
  - Day chart bars: Show on-calls that occurred on that day (Europe/London timezone)
  - Details displayed in a dialog with full incident information, sorted by most recent first
  - Analytics API includes studentId in byStudent data to enable accurate filtering
- **Summary Statistics**: Total, open, and completed on-call counts

#### Permission Management UI
- **Location**: School Memberships page (`/memberships`)
- **Access Control**: Admin or Creator role required
- **Conditional Display**: "Behaviour Access" column and permission toggle only shown when school has behaviour feature enabled
- **Visual Indicators**: "Manager" badge displayed in table for users with `canManageBehaviour` permission
- **Edit Interface**: Switch component in membership edit dialog allows toggling behaviour management access
- **Real-time Updates**: Table refreshes immediately after permission changes
- **Validation**: Backend validates permission updates using Zod schema

#### Technical Implementation
- **Database Tables**: 
  - `students`: id, schoolId, name, send, pp, isArchived
  - `oncalls`: id, schoolId, studentId, status, location, description, requestedById, completedById, completionNotes, createdAt, completedAt
  - `school_memberships.canManageBehaviour`: Boolean field controlling behaviour management access
- **API Routes**: 
  - RESTful endpoints for students, oncalls, CSV import, analytics
  - PATCH `/api/memberships/:id` - Updates membership permissions including `canManageBehaviour`
- **Permission Middleware**: `requireFeature("behaviour")` checks feature flag and extracts schoolId from on-call/student/analytics requests
- **Email Integration**: Resend service for instant notifications with HTML templates
- **CSV Parsing**: Client-side validation and duplicate handling
- **Frontend**: 
  - On-Call page (incident submission)
  - Behaviour Management page (three-tab admin interface)
  - School Memberships page (permission management with conditional behaviour access controls)