# CompareExcel - Complete Project Plan

## Project Overview

**Name:** CompareExcel
**Domain:** compareexcel.com
**Tech Stack:** Astro 5.x + Tailwind CSS v4 + TypeScript
**Design System:** Bugatti-inspired luxury dark theme (from DESIGN.md)

---

## Competitor Analysis (excelcompare.org)

### Current Features
| Feature | Details |
|---------|---------|
| **Three Comparison Modes** | Compare Files (full sheet), Compare Columns (set ops), Reconcile (ID-based) |
| **Synchronized Scrolling** | Both sheets scroll together in lockstep |
| **Color-Coded Diffs** | Yellow=changed, Red=deleted, Green=added |
| **Client-Side Processing** | No server upload, 100% private |
| **Format Support** | .xlsx, .xls, .csv (mixable) |
| **Sheet Selection** | Compare tabs within same workbook |
| **Large File Handling** | Tens of thousands of rows |
| **No Account Required** | Free, instant access |

### Competitor Weaknesses to Exploit
1. **Generic UI** - Standard SaaS look, no brand identity
2. **Limited Export/Sharing** - No shareable links, no PDF/HTML export
3. **No Collaboration** - Single-user only, no comments/annotations
4. **Basic Diff Algorithm** - Row-position based, struggles with reordered data
5. **No Formula Comparison** - Only compares displayed values
6. **No Batch Processing** - One comparison at a time
7. **No API/Integration** - Can't embed or automate
8. **Mobile Experience** - Desktop-first, poor on tablets
9. **No Accessibility Focus** - Basic keyboard nav only
10. **No Version History** - Can't track changes over time

---

## Design System Implementation (from DESIGN.md)

### Color Palette (Tailwind v4 Config)
```css
@theme {
  --color-canvas: #000000;
  --color-surface-soft: #0d0d0d;
  --color-surface-card: #141414;
  --color-surface-elevated: #1f1f1f;
  --color-hairline: #262626;
  --color-hairline-strong: #3a3a3a;
  --color-ink: #ffffff;
  --color-body: #cccccc;
  --color-body-strong: #e6e6e6;
  --color-muted: #999999;
  --color-muted-soft: #666666;
  --color-link: #c3d9f3;
  --color-warning: #d4a017;
  --color-success: #5fa657;
}
```

### Typography Scale
| Token | Font | Size | Weight | Tracking | Use |
|-------|------|------|--------|----------|-----|
| display-xl | Bugatti Display* | 64px | 400 | 4px | Hero H1 |
| display-lg | Bugatti Display | 48px | 400 | 3px | Section heads |
| display-md | Bugatti Display | 32px | 400 | 2px | Sub-sections |
| display-sm | Bugatti Display | 24px | 400 | 1.5px | Card titles |
| wordmark | Bugatti Display | 14px | 400 | 6px | Brand wordmark |
| title-md | Bugatti Display | 20px | 400 | 1px | Feature titles |
| title-sm | Bugatti Display | 16px | 400 | 1.5px | Mid headlines |
| caption-uppercase | Bugatti Mono | 11px | 400 | 2px | Metadata, labels |
| body-md | Bugatti Text** | 16px | 400 | 0 | Body copy |
| body-sm | Bugatti Text | 14px | 400 | 0 | Footer, legal |
| button | Bugatti Mono | 14px | 400 | 2.5px | Buttons |
| nav-link | Bugatti Mono | 12px | 400 | 2px | Navigation |

*Substitute: **Saira Condensed** (variable, wght 400) + 0.05em tracking
**Substitute: **Cormorant Garamond** or **EB Garamond**

### Spacing System
```css
@theme {
  --spacing-xxs: 4px;
  --spacing-xs: 8px;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 40px;
  --spacing-xxl: 64px;
  --spacing-section: 120px;
}
```

### Border Radius
- `rounded-none` (0px) - Default for all cards, inputs, containers
- `rounded-pill` (9999px) - Primary buttons only
- `rounded-full` (50%) - Icon buttons

### Component Specifications

#### Primary Button
```css
.btn-primary {
  @apply bg-transparent text-ink border border-ink rounded-pill px-8 py-3.5 h-11 font-mono uppercase tracking-[2.5px] text-[14px];
}
```

#### Text Input
```css
.input-text {
  @apply bg-transparent text-ink border-none border-b-[1px] border-hairline-strong px-0 py-3 h-11 font-serif text-[16px] placeholder:text-muted focus:border-ink focus:outline-none;
}
```

#### Card (Surface)
```css
.card {
  @apply bg-surface-card rounded-none p-6;
}
```

---

## Site Architecture (Astro)

### Route Structure
```
src/pages/
├── index.astro                    # Landing page
├── compare.astro                  # Main comparison tool (Compare Files)
├── compare-columns.astro          # Column comparison tool
├── reconcile.astro                # ID-based reconciliation tool
├── api/
│   └── share/
│       └── [id].astro             # Shareable result links
├── blog/
│   ├── index.astro                # Blog index
│   └── [slug].astro               # Blog posts
├── help/
│   ├── index.astro                # Help center
│   ├── getting-started.astro
│   ├── reconciliation-guide.astro
│   └── faq.astro
├── privacy.astro
├── terms.astro
└── contact.astro
```

### Component Structure
```
src/components/
├── layout/
│   ├── Header.astro               # Top nav with wordmark
│   ├── Footer.astro               # 4-column footer
│   └── Layout.astro               # Base layout wrapper
├── ui/
│   ├── Button.astro               # Primary, secondary, icon variants
│   ├── Input.astro                # File upload, text inputs
│   ├── Card.astro                 # Surface cards
│   ├── Tooltip.astro              # Help tooltips
│   └── Modal.astro                # Share modal, settings
├── comparison/
│   ├── FileDropZone.astro         # Drag-drop upload
│   ├── SheetSelector.astro        # Tab picker for workbooks
│   ├── DiffViewer.astro           # Main diff grid (React/Svelte island)
│   ├── SyncScroll.astro           # Synchronized scrolling wrapper
│   ├── DiffLegend.astro           # Color legend
│   ├── ColumnMatcher.astro        # Column mapping UI
│   ├── ReconcileConfig.astro      # Key/value column picker
│   └── ResultToolbar.astro        # Export, share, filter actions
├── landing/
│   ├── Hero.astro                 # Full-bleed photo band
│   ├── FeatureGrid.astro          # 3-mode feature cards
│   ├── Testimonials.astro         # Carousel
│   ├── TrustBadges.astro          # Security, privacy badges
│   └── CTA.astro                  # Photo-band CTA
└── shared/
    ├── Wordmark.astro             # Brand wordmark
    ├── LoadingSpinner.astro
    └── ErrorBoundary.astro
```

### Islands (Interactive Components)
```typescript
// astro.config.mjs
integrations: [
  react(), // For DiffViewer, SyncScroll
],
```

**Islands needed:**
- `DiffViewer` - Virtualized grid with 10k+ row support
- `SyncScroll` - Coordinated scroll state across two grids
- `ColumnMatcher` - Drag-drop column mapping
- `ReconcileConfig` - Interactive key/value selection

---

## Core Features (MVP + Enhancements)

### Phase 1: MVP (Weeks 1-4)

| Feature | Priority | Notes |
|---------|----------|-------|
| File Upload (drag-drop, click) | P0 | Client-side SheetJS/xlsx parsing |
| Sheet Selection (per file) | P0 | Dropdown per panel |
| Full Sheet Diff (Compare Files) | P0 | Cell-by-cell, synchronized scroll |
| Color-Coded Highlights | P0 | Yellow/Red/Green per DESIGN.md palette |
| Column Comparison (Compare Columns) | P1 | Set operations: intersection, unique L/R |
| Reconcile Mode (ID-based) | P1 | Key column + value columns, filter results |
| Shareable Links | P1 | Compress result to URL fragment |
| Export (CSV, HTML, PDF) | P1 | Client-side generation |
| Responsive Design | P0 | Mobile-first, touch-friendly |
| Accessibility (WCAG 2.1 AA) | P0 | Keyboard, screen readers, contrast |

### Phase 2: Differentiation (Weeks 5-8)

| Feature | Priority | Competitive Advantage |
|---------|----------|----------------------|
| **Formula Comparison** | P0 | Compare formulas, not just values |
| **Smart Row Matching** | P0 | Fuzzy match reordered rows by content |
| **Batch Compare** | P1 | Queue multiple file pairs |
| **Annotation/Comments** | P1 | Click cell → add note, export with diff |
| **Visual Diff Modes** | P1 | Side-by-side, overlay, unified view |
| **Column Profile Stats** | P2 | Null %, unique count, type detection |
| **Schema Comparison** | P2 | Detect column add/remove/type change |
| **Pivot Table Diff** | P2 | Compare aggregated views |
| **Dark/Light Theme Toggle** | P1 | Respect system preference + manual |

### Phase 3: Power Features (Weeks 9-12)

| Feature | Priority | Notes |
|---------|----------|-------|
| **API Access** | P2 | REST API for automation |
| **Embeddable Widget** | P2 | `<compare-excel>` web component |
| **Team Workspaces** | P3 | Shared comparisons, comments |
| **Version History** | P3 | Track changes across multiple versions |
| **Scheduled Comparisons** | P3 | Cron-like automated diffs |
| **Webhooks** | P3 | Notify on changes |
| **Custom Rules Engine** | P3 | Define "ignored" differences |
| **Plugin System** | P3 | Custom parsers, exporters |

---

## Technical Implementation Details

### File Processing Pipeline
```
User drops files
      ↓
SheetJS (xlsx) parses in Web Worker
      ↓
Normalize to uniform cell grid (row, col, value, formula, format)
      ↓
Diff Algorithm (Myers O(ND) for rows, cell-level for matched rows)
      ↓
Generate Diff OpCodes: EQUAL, INSERT, DELETE, MODIFY
      ↓
Virtualized Render (react-window / @tanstack/virtual)
      ↓
SyncScroll coordinator links two grids
```

### Diff Algorithm Enhancement
```typescript
// Beyond simple row-index comparison
interface RowSignature {
  hash: string;           // Hash of all cell values
  keyColumns: string[];   // Values of designated key columns
  rowIndex: number;       // Original position
}

// Matching strategy:
// 1. Exact key match (if keys defined)
// 2. Fuzzy content match (Levenshtein on row signature)
// 3. Position fallback (original behavior)
```

### Synchronized Scrolling Implementation
```typescript
// Shared scroll state via React Context
const SyncScrollContext = createContext<{
  scrollTop: number;
  scrollLeft: number;
  setScroll: (top: number, left: number) => void;
  register: (id: 'left' | 'right', element: HTMLElement) => void;
}>();

// Each grid registers, listens to shared state
// Uses requestAnimationFrame for smooth sync
```

### Performance Targets
| Metric | Target |
|--------|--------|
| Initial Load (TTI) | < 2.5s |
| 10k rows diff render | < 500ms |
| 100k rows diff render | < 2s |
| Memory (100k rows) | < 150MB |
| Scroll FPS | 60fps |

### Security & Privacy
- **Zero Server Processing** - All parsing/diffing in browser
- **No Analytics on Data** - Only anonymous usage metrics
- **CSP Headers** - Strict policy, no inline scripts
- **Subresource Integrity** - For CDN dependencies
- **No Cookies** - LocalStorage only for preferences

---

## Astro Configuration

### astro.config.mjs
```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';

export default defineConfig({
  site: 'https://compareexcel.com',
  output: 'hybrid', // Static for landing, SSR for tools
  adapter: node({ mode: 'standalone' }),
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    sitemap(),
    compress({ CSS: true, HTML: true, JavaScript: true, SVG: true }),
  ],
  vite: {
    optimizeDeps: {
      include: ['xlsx', 'react-window'],
    },
    worker: {
      format: 'es',
    },
  },
  prefetch: { prefetchAll: true },
});
```

### Tailwind v4 Setup (CSS-first)
```css
/* src/styles/global.css */
@import "tailwindcss";

@theme {
  /* Colors, spacing, typography from DESIGN.md */
  --color-canvas: #000000;
  --color-surface-card: #141414;
  --color-hairline: #262626;
  --color-ink: #ffffff;
  --color-body: #cccccc;
  --color-muted: #999999;
  --color-link: #c3d9f3;
  --color-warning: #d4a017;
  --color-success: #5fa657;
  
  --font-display: "Saira Condensed", sans-serif;
  --font-body: "Cormorant Garamond", serif;
  --font-mono: "JetBrains Mono", monospace;
  
  --spacing-section: 120px;
  --spacing-xl: 40px;
  --spacing-lg: 24px;
  --spacing-md: 16px;
  --spacing-sm: 12px;
  --spacing-xs: 8px;
  --spacing-xxs: 4px;
}

/* Base styles */
* { @apply border-hairline; }
html { @apply bg-canvas text-body antialiased; }
body { @apply font-body text-base leading-relaxed; }

/* Display utility */
.text-display-xl { @apply font-display uppercase tracking-[4px] text-[64px] leading-[1.1] font-normal; }
.text-display-lg { @apply font-display uppercase tracking-[3px] text-[48px] leading-[1.15] font-normal; }
.text-display-md { @apply font-display uppercase tracking-[2px] text-[32px] leading-[1.2] font-normal; }
.text-display-sm { @apply font-display uppercase tracking-[1.5px] text-[24px] leading-[1.3] font-normal; }
.text-wordmark { @apply font-display uppercase tracking-[6px] text-[14px] leading-none font-normal; }
.text-title-md { @apply font-display uppercase tracking-[1px] text-[20px] leading-[1.3] font-normal; }
.text-title-sm { @apply font-display uppercase tracking-[1.5px] text-[16px] leading-[1.3] font-normal; }
.text-caption { @apply font-mono uppercase tracking-[2px] text-[11px] leading-[1.4] font-normal; }
.text-button { @apply font-mono uppercase tracking-[2.5px] text-[14px] leading-none font-normal; }
.text-nav { @apply font-mono uppercase tracking-[2px] text-[12px] leading-[1.4] font-normal; }

/* Components */
.btn-primary { @apply bg-transparent text-ink border border-ink rounded-pill px-8 py-3.5 h-11 text-button; }
.btn-primary:hover { @apply bg-ink text-canvas; }
.input-text { @apply bg-transparent text-ink border-none border-b border-hairline-strong px-0 py-3 h-11 font-body text-base placeholder:text-muted focus:border-ink focus:outline-none; }
.card { @apply bg-surface-card rounded-none p-6; }
```

---

## Development Phases & Timeline

### Week 1-2: Foundation
- [ ] Initialize Astro + Tailwind v4 + TypeScript
- [ ] Configure design tokens (colors, typography, spacing)
- [ ] Build base layout (Header, Footer, Layout)
- [ ] Implement Hero section with full-bleed photography
- [ ] Set up font loading (Saira Condensed, Cormorant Garamond, JetBrains Mono)
- [ ] Configure build pipeline, linting, type checking

### Week 3-4: Core Comparison Engine
- [ ] Integrate SheetJS (xlsx) with Web Worker
- [ ] Build FileDropZone with drag-drop + click
- [ ] Implement SheetSelector for multi-tab workbooks
- [ ] Develop Diff Algorithm (Myers O(ND) + cell-level)
- [ ] Create DiffViewer island (React + virtualized grid)
- [ ] Implement SyncScroll coordinator
- [ ] Add color-coded highlighting (custom palette)
- [ ] Build ResultToolbar (export, share, filter)

### Week 5-6: Three Comparison Modes
- [ ] Compare Files (full sheet) - complete
- [ ] Compare Columns (set operations)
- [ ] Reconcile (ID-based key/value matching)
- [ ] Shared routing: `/compare`, `/compare-columns`, `/reconcile`
- [ ] URL state persistence (shareable links)

### Week 7-8: Polish & Differentiation
- [ ] Formula comparison mode
- [ ] Smart row matching (fuzzy)
- [ ] Export: CSV, HTML, PDF (client-side)
- [ ] Dark/Light theme toggle
- [ ] Accessibility audit + fixes
- [ ] Mobile responsive testing
- [ ] Performance optimization (virtualization, workers)

### Week 9-10: Content & Launch Prep
- [ ] Landing page (Hero, Features, Testimonials, CTA)
- [ ] Help center (Getting Started, Guide, FAQ)
- [ ] Legal pages (Privacy, Terms, Cookie)
- [ ] SEO optimization (meta, sitemap, structured data)
- [ ] Analytics (privacy-friendly: Plausible/Umami)
- [ ] Error monitoring (Sentry)
- [ ] Deploy to Vercel/Netlify/Cloudflare

### Week 11-12: Post-Launch Iteration
- [ ] User feedback collection
- [ ] Bug fixes
- [ ] Performance monitoring
- [ ] Plan Phase 2 features

---

## Key Differentiators (vs excelcompare.org)

| Area | excelcompare.org | CompareExcel (Our Plan) |
|------|------------------|------------------------|
| **Brand/Design** | Generic SaaS | Luxury dark theme, distinctive typography |
| **Formula Diff** | ❌ Values only | ✅ Formulas + values |
| **Row Matching** | Position only | ✅ Smart fuzzy + key-based |
| **Export/Share** | Basic | ✅ PDF, HTML, embeddable, share links |
| **Annotations** | ❌ | ✅ Cell comments, export with diff |
| **Batch Compare** | ❌ | ✅ Queue multiple pairs |
| **API/Embed** | ❌ | ✅ REST API + Web Component |
| **Visual Modes** | Side-by-side only | ✅ Side-by-side, overlay, unified |
| **Schema Diff** | ❌ | ✅ Column add/remove/type detection |
| **Mobile** | Poor | ✅ Touch-optimized, responsive |
| **Accessibility** | Basic | ✅ WCAG 2.1 AA |
| **Performance** | Good | ✅ Virtualized, worker-threaded |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Large file performance | High | High | Web Workers, virtualization, streaming parse |
| Browser memory limits | Medium | High | Chunked processing, cleanup, limits warning |
| SheetJS license (GPL) | Low | High | Use MIT alternative (exceljs) or commercial |
| Diff accuracy edge cases | Medium | Medium | Extensive test suite, user feedback loop |
| Mobile touch scrolling | Medium | Medium | Test early, native scroll, passive listeners |
| SEO for tool pages | Low | Medium | Prerender landing, SSR tools, structured data |

---

## Success Metrics

| Metric | Target (Month 3) | Target (Month 12) |
|--------|------------------|-------------------|
| Monthly Active Users | 10,000 | 100,000 |
| Comparisons/Day | 1,000 | 50,000 |
| Avg Session Duration | 3 min | 5 min |
| Return Rate (7-day) | 15% | 30% |
| NPS | 40 | 60 |
| Organic Traffic % | 40% | 60% |
| Mobile Usage % | 25% | 35% |

---

## Next Steps

1. **Approve this plan** - Confirm scope, timeline, priorities
2. **Initialize project** - `npm create astro@latest` with TypeScript, Tailwind
3. **Set up design system** - Implement DESIGN.md tokens in Tailwind v4
4. **Build landing page first** - Validate design, get early feedback
5. **Develop comparison engine** - Core technical challenge
6. **Iterate based on testing** - Real user testing with sample files

---

*Plan created: 2026-09-26*
*Version: 1.0*