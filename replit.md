# Anaxi - Teacher Observation Platform

## Overview
Anaxi is a professional teacher observation and development platform for schools. It enables educators to conduct peer observations using custom rubrics, provide structured feedback via habit-based checklists, and track professional development. The platform supports multiple schools with role-based workflows for observers and teachers, focusing on clarity and efficiency.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (October 21, 2025)

### Teacher Role Editing
Added ability to edit teacher roles in App Management:

**Edit Teacher Dialog**:
- New "Role" select field in the edit teacher dialog
- Options: Teacher, Leader, Admin
- Role changes apply to all schools the teacher is assigned to
- Uses `/api/memberships/:id` PATCH endpoint to update roles
- Fetches current role from teacher's school memberships

**Implementation Details**:
- Edit dialog now fetches teacher's memberships when opened
- Displays current role (from first membership)
- Updates all school memberships with the selected role
- Shows helpful message that role will be updated across all schools

### CSV Import Enhancement
Enhanced CSV import functionality for both Teachers and Rubrics:

**CSV Column Mapper Component**:
- New reusable component at `client/src/components/csv-column-mapper.tsx`
- Allows users to upload CSV files via file input
- Provides interactive column mapping interface
- Shows preview of first 3 rows
- Auto-maps columns with matching names
- Validates that all required fields are mapped before import

**Teacher CSV Import**:
- File upload instead of paste-only interface
- Flexible column mapping (users select which CSV column maps to each field)
- School name matching: accepts school names (semicolon-separated) instead of requiring school IDs
- Automatically matches school names to school IDs (case-insensitive)
- Displays warnings for unmatched school names
- Required fields: email, password, first_name, last_name
- Optional field: schoolNames (semicolon-separated list)
- schoolIds array correctly passed to backend for proper school assignment

**Rubric CSV Import**:
- File upload with column mapping interface
- Groups multiple habits under the same category name
- Required fields: categoryName, habitDescription
- Imports new categories and habits into rubric system
- Shows success toast with count of imported categories and habits

**UI Improvements**:
- Import CSV and Add Teacher buttons now visible in embedded App Management view
- Larger dialog sizes (max-w-4xl) for CSV import to accommodate mapper interface
- Import buttons disabled until all required fields are mapped

### Meetings & Conversations Refactor
Separated Meetings and Conversations into distinct workflows with different field requirements:

**Meetings**:
- Fields: type (Line Management/Department/Leadership), subject, details, attendees (multi-select at top), action items
- NO rating field, NO minutes field
- Meeting types changed from "two_person"/"group" to organizational types
- Simplified to use only "Details" field for all meeting notes
- Attendees section moved to top of form for better UX

**Conversations**:
- Fields: subject, details, rating (Best Practice/Neutral/Concern), single staff member
- NO type field, NO action items, NO multi-select attendees
- Conversations use single "Staff Member" dropdown next to rating
- Single staff member automatically added as attendee

**Implementation Details**:
- Conditional payload construction in mutation based on formType
- Client-side validation ensures rating selection for conversations
- Meetings table displays: Date, Type, Subject, Details (no Rating column)
- Filter dropdown uses new meeting types only
- Schema synced with database via `npm run db:push`

### App Management Consolidation
Created unified App Management page consolidating management sections:

**New Structure**:
- Single "App Management" link in sidebar (replaced separate Manage Rubric, Manage Teachers, and Manage Schools links)
- Tabbed interface with three sections: Rubrics, Teachers, and Schools
- URL hash-based navigation for direct tab access (#rubrics, #teachers, #schools)
- Cleaner sidebar navigation - removed standalone "Manage Schools" menu item
- All management features (Rubrics, Teachers, Schools) now accessed through App Management tabs only

**Implementation Details**:
- Management pages support `isEmbedded` prop to remove their padding when shown in tabs
- Proper alignment maintained between page headers and tab content
- All management pages maintain standalone functionality when accessed directly

**Benefits**:
- Reduced sidebar clutter (3 links consolidated into 1)
- Easier navigation between management tasks
- Maintained all original functionality
- Better organization for admin tasks

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
- **School Management**: Creator-only `/schools` page for adding and editing schools. Simple interface focused on school CRUD operations only.
- **Teacher Management**: Centralized `/teachers` page (Admin/Creator access) for managing teacher accounts. Features include:
  - Add individual teachers with email/password authentication
  - Bulk CSV import for multiple teachers
  - Multi-school assignment per teacher
  - Teacher accounts are `users` with school memberships linking them to one or more schools
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