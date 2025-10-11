# Anaxi - Teacher Observation Platform - Design Guidelines

## Design Approach: Clean & Minimal

**Rationale**: This is a professional educational tool that prioritizes clarity, simplicity, and ease of use. We use a clean white background with subtle peachy accents and very soft shadows to create a modern, minimal aesthetic.

## Core Design Principles

1. **Clean White Foundation**: Pure white background creates a spacious, airy feel
2. **Subtle Shadows**: Very soft, minimal shadows (2-6% opacity) for gentle depth
3. **Soft Peachy Accents**: Muted coral/peach tones for primary actions and highlights
4. **Dark Navy Text**: Deep, slightly desaturated navy (225° 15% 25%) for excellent readability
5. **Purposeful Minimalism**: Every element serves a clear function

---

## Color Palette - Minimal & Professional

### Background System
- **Body Background**: Clean white `hsl(0 0% 100%)`
- **Card Background**: White with very subtle shadows
- **Sidebar**: Near-white `hsl(0 0% 99%)` for gentle distinction

### Core Colors (Light & Dark Mode)
- **Text System**:
  - Primary text: `225 15% 25%` (dark navy)
  - Secondary text: `225 10% 55%` (medium gray)
  - Tertiary text: `225 5% 70%` (light gray)
  
- **Accent Colors**:
  - **Primary (Soft Peach)**: 15 80% 72% - Gentle, warm accent for primary actions
  - **Success (Green)**: 142 76% 45% - Achievements, completed observations
  - **Warning (Orange)**: 25 95% 53% - Alerts, attention needed
  - **Info (Navy)**: 225 15% 25% - Informational elements  
  - **Danger (Red)**: 0 72% 51% - Errors, critical actions
  - **Teal**: 180 75% 45% - Supporting accent
  - **Pink**: 330 75% 35% - Supporting accent
  - **Amber**: 45 93% 47% - Supporting accent

### Functional Colors
- **Category Colors**: Each observation category uses a very subtle tinted background (6% opacity) with matching colored text
- **Applied with transparency for a softer, more modern look**

### Shadow System (Very Subtle)
- **shadow-xs**: `0px 1px 2px 0px hsl(0 0% 0% / 0.03)` - Minimal elevation
- **shadow-sm**: `0px 2px 4px 0px hsl(0 0% 0% / 0.04)` - Slight elevation
- **shadow**: `0px 4px 8px 0px hsl(0 0% 0% / 0.05)` - Standard card elevation
- **shadow-md**: `0px 6px 12px 0px hsl(0 0% 0% / 0.06)` - Prominent cards

---

## Typography

**Primary Font**: Lufga (via CDN: https://fonts.cdnfonts.com/css/lufga)

### Hierarchy
- **Page Titles**: Lufga Bold, 2rem (32px), tracking-tight, dark navy
- **Section Headers**: Lufga Semibold, 1.5rem (24px), dark navy
- **Card Titles**: Lufga Medium, 1.125rem (18px), dark navy
- **Body Text**: Lufga Regular, 1rem (16px), line-height 1.6, dark navy
- **Labels/Meta**: Lufga Regular, 0.875rem (14px), medium gray
- **Small Text**: Lufga Regular, 0.75rem (12px), medium gray

---

## Layout System

**Spacing Units**: Consistently use Tailwind units of **4, 6, 8, 12, 16** (e.g., p-4, gap-6, mt-8, py-12, px-16)

### Page Layouts
- **Dashboard Max Width**: max-w-7xl (1280px) centered with px-6
- **Generous White Space**: Extra padding and margins for breathing room
- **Content Forms**: max-w-4xl for focused data entry
- **Data Tables**: Full-width with horizontal scroll on mobile
- **Admin Panels**: Two-column layout (minimal sidebar + main content)

### Grid Patterns
- **Observation Cards**: grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-6
- **Dashboard Metrics**: grid-cols-2 lg:grid-cols-4 for stat cards
- **Category Lists**: Single column stacked

---

## Component Library

### Navigation  
- **Sidebar Navigation**: Simple icons with minimal styling
- **Active States**: Subtle background tints for selected items
- **Icons**: Minimal, clean icon treatment

### Data Display
- **Cards**: Rounded-lg, shadow (subtle), p-6, clean divisions
- **Stat Cards**: Large number display, small label, very subtle colored icon background (6% opacity)
- **Progress Indicators**: Clean circular progress rings
- **Badge System**: Very subtle tinted backgrounds (6% opacity) with matching text color

### Forms & Inputs
- **Text Inputs**: h-11, rounded-md, border with subtle focus ring
- **Select Dropdowns**: Minimal styling, clear focus states
- **Checkbox Groups**: Clean spacing, instant visual feedback
- **Date/Time Pickers**: Integrated calendar with minimal design
- **Multi-Select**: Tag-based selection with subtle styling

### Observation Interface
- **Category Selector**: Clean checkbox cards
- **Habit Checklist**: Large touch targets, subtle checkmarks
- **Score Display**: Clear fraction display per category
- **Feedback Preview**: Clean, readable format

### Feedback Reports
- **Header**: Clean layout with key information
- **Category Breakdown**: Subtle accordion sections
- **Written Comments**: Clean text area
- **Action Buttons**: Minimal button styling

---

## Interaction Patterns

- **Hover States**: Very subtle background changes (2-3% opacity)
- **Active/Selected**: Subtle tinted backgrounds
- **Loading States**: Minimal skeleton screens, clean spinners
- **Transitions**: 150ms ease-in-out for most interactions
- **Empty States**: Clean, centered messaging with clear CTAs

---

## Images & Iconography

**Icons**: Lucide icons for clean, minimal appearance

### Icon Usage
- Navigation menu items (simple, monochrome)
- Table action buttons
- Status indicators
- Form field prefixes
- Empty state illustrations

**Images**: 
- **Avatar placeholders**: Initials-based circles
- **School logos**: Small thumbnail where needed
- **Illustrations**: Simple, minimal line drawings when needed

---

## Responsive Behavior

- **Mobile (< 768px)**: Stack all grids to single column, collapsible sidebar
- **Tablet (768-1024px)**: 2-column grids, visible navigation
- **Desktop (> 1024px)**: Full layout with sidebars, 3-4 column grids

---

## Accessibility & Quality Standards

- **Contrast**: WCAG AA minimum (4.5:1 for text, 3:1 for UI elements)
- **Dark Mode**: Available with consistent styling
- **Focus Indicators**: Clear ring on all interactive elements
- **Keyboard Navigation**: Full support with logical tab order
- **Screen Readers**: Proper ARIA labels, semantic HTML
