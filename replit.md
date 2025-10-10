# Anaxi - Teacher Observation Platform

## Overview

Anaxi is a professional teacher observation and development platform designed for schools. The application enables educators to conduct peer observations using custom rubrics, provide structured feedback through habit-based checklists, and track professional development over time. The platform emphasizes clarity and efficiency, supporting multiple schools with role-based workflows for observers and teachers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, using Vite as the build tool and development server.

**UI Framework**: Built on shadcn/ui component library with Radix UI primitives, providing accessible, customizable components following the "new-york" style variant.

**Styling Approach**: Tailwind CSS with a custom design system based on Fluent Design principles. The application uses CSS variables for theming, supporting both light and dark modes. Custom color palette emphasizes professional clarity with neutral tones (charcoal, warm grays) and purposeful accent colors for status indicators (green for observed habits, orange for unobserved).

**Typography**: Custom font implementation using Lufga from CDN, with defined hierarchy for page titles, section headers, card titles, body text, and labels.

**Routing**: Client-side routing implemented with Wouter (lightweight alternative to React Router).

**State Management**: TanStack Query (React Query) for server state management with custom query client configuration. Local component state managed with React hooks.

**Design Patterns**:
- Component-based architecture with reusable UI components
- Compound component pattern for complex UI elements (dialogs, dropdowns, accordions)
- Custom hooks for shared logic (mobile detection, toast notifications)
- Example components provided for development reference

### Backend Architecture

**Runtime**: Node.js with Express server framework.

**Language**: TypeScript with ES modules.

**API Design**: RESTful API structure with `/api` prefix for all application routes. Centralized route registration through `registerRoutes` function.

**Storage Layer**: Abstracted storage interface (`IStorage`) with in-memory implementation (`MemStorage`) for development. Designed to support database integration through interface implementation pattern.

**Session Management**: Prepared for session-based authentication using connect-pg-simple for PostgreSQL session store.

**Development Features**:
- Request/response logging middleware with performance metrics
- Vite integration for HMR during development
- Error handling middleware with status code normalization

### Data Architecture

**ORM**: Drizzle ORM configured for PostgreSQL with Neon serverless database support.

**Schema Design**: Type-safe schema definitions using Drizzle with Zod validation integration. Currently implements basic user model with username/password authentication foundation.

**Database Connection**: Connection pooling using @neondatabase/serverless with WebSocket support for serverless environments.

**Migrations**: Drizzle Kit configured for schema migrations with output to `/migrations` directory.

**Data Flow**: 
- Schema definitions shared between client and server through `@shared` alias
- Type inference from database schema using Drizzle's type utilities
- Validation schemas generated from database models using drizzle-zod

### Design System

**Core Principles**:
1. System-based design with Fluent Design influence
2. Professional clarity over decoration
3. Clear data hierarchy and visual distinction
4. Institutional trust through stable, sophisticated design

**Elevation System**: CSS-based hover and active states using custom `--elevate-1` and `--elevate-2` variables for subtle background overlays, creating depth without heavy shadows.

**Component Variants**: Comprehensive button and badge variants (default, destructive, outline, secondary, ghost) with consistent border and shadow treatments.

**Responsive Design**: Mobile-first approach with breakpoint-aware components and custom mobile detection hook.

## External Dependencies

### Core Framework Dependencies
- **React 18**: UI library with concurrent features
- **TypeScript**: Type safety across frontend and backend
- **Vite**: Build tool and dev server with plugin ecosystem
- **Express**: Backend web framework
- **Drizzle ORM**: Type-safe database toolkit

### Database & Storage
- **@neondatabase/serverless**: Serverless PostgreSQL client with WebSocket support
- **connect-pg-simple**: PostgreSQL session store for Express

### UI Component Libraries
- **Radix UI**: Headless UI primitives (@radix-ui/react-*)
  - Complete suite including dialog, dropdown, popover, select, tabs, tooltip, etc.
  - Ensures accessibility compliance and keyboard navigation
- **shadcn/ui**: Component library configuration and tooling
- **Tailwind CSS**: Utility-first CSS framework
- **class-variance-authority**: Type-safe variant management for components
- **cmdk**: Command menu/palette component
- **embla-carousel-react**: Carousel/slider component

### Form & Data Management
- **React Hook Form**: Form state management with @hookform/resolvers
- **Zod**: Schema validation library
- **TanStack Query**: Server state management and caching
- **date-fns**: Date manipulation and formatting

### Development Tools
- **Replit Plugins**: Development tooling for Replit environment
  - vite-plugin-runtime-error-modal
  - vite-plugin-cartographer (development only)
  - vite-plugin-dev-banner (development only)

### Typography & Assets
- **Lufga Font**: Custom typography via CDN (https://fonts.cdnfonts.com/css/lufga)
- **Lucide React**: Icon library for UI elements

### Build & Deployment
- **esbuild**: JavaScript bundler for production server bundle
- **tsx**: TypeScript execution for development
- **PostCSS**: CSS processing with Autoprefixer
- **WebSocket (ws)**: WebSocket implementation for Neon database connection