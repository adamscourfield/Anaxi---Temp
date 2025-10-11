# Anaxi - Teacher Observation Platform - Design Guidelines

## Design Approach: Vibrant Professional

**Rationale**: This is a professional educational tool that should feel engaging, modern, and encouraging. We use color purposefully to create visual interest, guide attention, and make the experience more enjoyable for educators while maintaining clarity and usability.

## Core Design Principles

1. **Colorful Clarity**: Use vibrant colors to enhance comprehension and create visual hierarchy
2. **Purposeful Vibrancy**: Every color serves a functional and emotional purpose
3. **Educational Energy**: The design should feel alive, encouraging, and supportive
4. **Professional Playfulness**: Sophisticated use of color that maintains credibility

---

## Color Palette - Vibrant & Purposeful

### Core Colors (Light & Dark Mode)
- **Primary (Purple)**: 239 84% 67% - Main brand color, primary actions, key CTAs
- **Success (Green)**: 142 76% 45% - Achievements, completed observations, high scores
- **Warning (Orange)**: 25 95% 53% - Alerts, missing habits, attention needed
- **Info (Blue)**: 210 85% 58% - Informational elements, analytics, insights  
- **Danger (Red)**: 0 72% 51% - Errors, critical actions, deletions
- **Teal**: 180 75% 45% - Teaching groups, collaboration features
- **Amber**: 45 93% 47% - Pending items, scheduled observations
- **Pink**: 330 75% 58% - User profiles, personal features

### Functional Colors
- **Category Colors**: Each observation category gets a distinct color for easy recognition
  - Entrance & Do Now: Purple (239 84% 67%)
  - Direct Instruction: Blue (210 85% 58%)
  - Checking Understanding: Teal (180 75% 45%)
  - Application: Green (142 76% 45%)
  - Behaviour Routines: Orange (25 95% 53%)
  - Exit Routine: Pink (330 75% 58%)

### Implementation Strategy
- Use color backgrounds at 10-15% opacity for cards and sections
- Full saturation colors for icons, badges, and CTAs
- Color-coded visual cues throughout (progress bars, status indicators, category tags)

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