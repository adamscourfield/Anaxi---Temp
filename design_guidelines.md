# Teacher Observation Platform - Design Guidelines

## Design Approach: System-Based (Fluent Design Influence)

**Rationale**: This is a utility-focused, information-dense professional tool where efficiency, data clarity, and consistency are paramount. The design prioritizes usability for educators conducting observations, managing rubrics, and analyzing performance data.

## Core Design Principles

1. **Professional Clarity**: Clean, uncluttered interfaces that support focused work
2. **Data Hierarchy**: Clear visual distinction between primary actions, data displays, and navigation
3. **Purposeful Restraint**: Minimal decoration; every element serves a functional purpose
4. **Institutional Trust**: Sophisticated, stable design that conveys reliability

---

## Color Palette

### Light Mode
- **Primary Brand**: 24 5% 15% (Deep charcoal - headers, primary buttons)
- **Secondary**: 28 8% 35% (Warm gray - secondary elements)
- **Background**: 0 0% 98% (Off-white)
- **Surface**: 0 0% 100% (Pure white - cards, panels)
- **Border**: 0 0% 88% (Light gray)
- **Text Primary**: 24 5% 15%
- **Text Secondary**: 28 8% 45%
- **Accent (Success/Observed)**: 142 65% 42% (Muted green for habit observations)
- **Warning (Missing)**: 15 75% 55% (Earth orange for unobserved habits)

### Dark Mode
- **Primary Brand**: 0 0% 95% (Light text on dark)
- **Secondary**: 28 8% 75%
- **Background**: 24 5% 8% (Deep charcoal background)
- **Surface**: 24 5% 12% (Elevated surfaces)
- **Border**: 0 0% 22%
- **Text Primary**: 0 0% 95%
- **Text Secondary**: 28 8% 65%
- **Accent**: Same hues, adjusted lightness for dark backgrounds

---

## Typography

**Primary Font**: Lufga (via CDN: https://fonts.cdnfonts.com/css/lufga)

### Hierarchy
- **Page Titles**: Lufga Bold, 2rem (32px), tracking-tight
- **Section Headers**: Lufga Semibold, 1.5rem (24px)
- **Card Titles**: Lufga Medium, 1.125rem (18px)
- **Body Text**: Lufga Regular, 1rem (16px), line-height 1.6
- **Labels/Meta**: Lufga Regular, 0.875rem (14px), tracking-wide
- **Small Text**: Lufga Regular, 0.75rem (12px)

---

## Layout System

**Spacing Units**: Consistently use Tailwind units of **4, 6, 8, 12, 16** (e.g., p-4, gap-6, mt-8, py-12, px-16)

### Page Layouts
- **Dashboard Max Width**: max-w-7xl (1280px) centered with px-6
- **Content Forms**: max-w-4xl for focused data entry
- **Data Tables**: Full-width with horizontal scroll on mobile
- **Admin Panels**: Two-column layout (sidebar navigation + main content)

### Grid Patterns
- **Observation Cards**: grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-6
- **Rubric Categories**: Single column stacked, each habit as compact row
- **Dashboard Metrics**: grid-cols-2 lg:grid-cols-4 for stat cards

---

## Component Library

### Navigation
- **Top Navigation Bar**: Fixed, h-16, with school selector dropdown, user profile, notifications
- **Sidebar Navigation** (Admin): w-64, collapsible on mobile, category-grouped menu items
- **Breadcrumbs**: Small text with chevron separators for deep navigation

### Data Display
- **Tables**: Striped rows, hover states, sortable headers with icons, sticky header on scroll
- **Cards**: Rounded-lg, shadow-sm, p-6, clear header/content/footer divisions
- **Stat Cards**: Large number display, small label, subtle icon, optional trend indicator
- **Progress Indicators**: Linear bars showing observation completion, category scores (habit count visualization)
- **Badge System**: Rounded-full pills for status (Scheduled, Completed, In Progress), observation scores

### Forms & Inputs
- **Text Inputs**: h-11, rounded-md, border focus ring with primary color
- **Select Dropdowns**: Searchable for long lists (teacher selection, category filtering)
- **Checkbox Groups**: For habit selection during observations - clear spacing, instant visual feedback
- **Date/Time Pickers**: Integrated calendar for observation scheduling
- **Multi-Select**: Tag-based selection for categories to observe
- **File Upload**: Drag-drop zone for CSV import with clear format instructions

### Observation Interface
- **Category Selector**: Checkbox cards showing category name + habit count
- **Habit Checklist**: Large touch targets, instant scoring update, visual checkmarks
- **Score Display**: Prominent fraction display (e.g., "3/5") per category, total score summary
- **Feedback Preview**: Auto-populate unobserved habit descriptions as structured feedback

### Feedback Reports
- **Header**: Observer name, date, overall score, categories observed
- **Category Breakdown**: Accordion sections, each showing observed (green checkmark) vs. missed (orange icon with description)
- **Written Comments**: Rich text area, expandable for detailed notes
- **Action Buttons**: Download PDF, Share, Schedule Follow-up

### Admin Tools
- **User Table**: Sortable, filterable, bulk actions (assign school, deactivate)
- **CSV Import Modal**: Step-by-step wizard (upload → preview → confirm → import status)
- **School Switcher**: Dropdown with search, clear visual indicator of current school
- **Rubric Builder**: Drag-to-reorder categories/habits, inline editing, duplicate protection

---

## Interaction Patterns

- **Hover States**: Subtle background lightening (5-10%), no dramatic color shifts
- **Active/Selected**: Solid primary background for selected items, border highlight for focus
- **Loading States**: Skeleton screens for tables/cards, spinner for actions
- **Transitions**: 150ms ease-in-out for most interactions, 300ms for sidebars/modals
- **Empty States**: Centered illustrations with clear CTAs ("Add Your First Rubric")

---

## Images & Iconography

**Icons**: Heroicons (outline for default, solid for active states) via CDN

### Icon Usage
- Navigation menu items
- Table action buttons (edit, delete, view)
- Status indicators (checkmark, warning, info)
- Form field prefixes
- Empty state illustrations

**Images**: 
- **No hero sections** - This is a utility application, not a marketing site
- **Avatar placeholders**: Initials-based colored circles for teacher profiles
- **School logos**: Small thumbnail in navigation/headers (upload by admin)

---

## Responsive Behavior

- **Mobile (< 768px)**: Stack all grids to single column, collapsible sidebar, simplified tables (card view)
- **Tablet (768-1024px)**: 2-column grids, visible navigation, compact spacing
- **Desktop (> 1024px)**: Full layout with sidebars, 3-4 column grids, expanded data tables

---

## Accessibility & Quality Standards

- **Contrast**: WCAG AA minimum (4.5:1 for text, 3:1 for UI elements)
- **Dark Mode**: Consistent across all components, including form inputs
- **Focus Indicators**: 2px ring on all interactive elements
- **Keyboard Navigation**: Full support with logical tab order
- **Screen Readers**: Proper ARIA labels, semantic HTML throughout