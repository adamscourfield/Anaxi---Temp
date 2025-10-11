# Anaxi - Teacher Observation Platform - Design Guidelines

## Design Approach: Warm & Elevated

**Rationale**: This is a professional educational tool that should feel warm, welcoming, and encouraging. We use a soft peachy gradient background with elevated card shadows to create depth and visual interest while maintaining clarity and usability.

## Core Design Principles

1. **Warm Gradient Foundation**: Radial gradient from peachy/salmon tones to white creates a soft, inviting atmosphere
2. **Elevated Cards**: Enhanced shadows (shadow-md) make cards appear to float above the background
3. **Professional Warmth**: Sophisticated color palette that maintains credibility while feeling approachable
4. **Purposeful Hierarchy**: Visual depth through shadows and subtle color transitions

---

## Color Palette - Warm & Professional

### Background System
- **Body Background**: Radial gradient from peachy (hue 20°) at top to white at bottom
  - Light mode: `radial-gradient(circle at top, hsl(20 90% 90%), hsl(20 30% 98%) 50%, white 100%)`
  - Dark mode: Radial gradient from darker blues for consistency
- **Card Elevation**: Cards use shadow-md (0px 6px 16px) for prominent elevation effect

### Core Colors (Light & Dark Mode)
- **Greyscale System**:
  - Main text: `0 0% 15%` (dark grey)
  - Secondary text: `0 0% 50%` (medium grey)
  - Sidebar icons: `0 0% 45%` (greyscale, not colored)
  - Borders: `0 0% 88%` (light grey)
  - Sidebar background: `0 0% 98%` (very light grey)
  
- **Accent Colors** (for functional elements only):
  - **Primary (Peachy/Salmon)**: 15 85% 65% - Primary actions, key CTAs, active states
  - **Success (Green)**: 142 76% 45% - Achievements, completed observations, high scores
  - **Warning (Orange)**: 25 95% 53% - Alerts, missing habits, attention needed
  - **Info (Blue)**: 210 85% 58% - Informational elements, analytics, insights  
  - **Danger (Red)**: 0 72% 51% - Errors, critical actions, deletions
  - **Dark Navy**: 220 25% 25% - Chart contrast, dark accents

### Functional Colors
- **Category Colors**: Each observation category gets a distinct color for easy recognition
  - Categories maintain their distinct colors for data visualization
  - Applied with subtle backgrounds and clear borders

### Implementation Strategy
- Gradient background provides warmth without overwhelming content
- Cards appear elevated with shadow-md for visual hierarchy
- Subtle color accents for functional elements (badges, status indicators)
- Consistent shadow system: shadow-sm for minor elevation, shadow-md for cards

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
- **Sidebar Navigation**: Colorful icons with subtle background tints matching their function
- **Active States**: Bold color backgrounds for selected menu items
- **Icons**: Use colored icons (not just monochrome) with matching background pills

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