# Claude Agents Monitor — Brand Guidelines

## Brand Positioning

**For** developers running Claude Code agent swarms
**Who need** real-time visibility and control over multiple AI agent processes
**Claude Agents Monitor is** the mission control dashboard
**That** provides centralized monitoring, cost tracking, workflow orchestration, and project intelligence
**Unlike** manual terminal management or blind agent execution
**We** give you calm authority over your entire agent fleet

## Brand Personality

**Archetype:** The Sage (precision, clarity) + The Ruler (control, stability)

**We are...**
- Precise, but not clinical
- Powerful, but not intimidating
- Technical, but not obtuse
- Calm, but not passive
- Real-time, but not chaotic

**Mood:** Mission control. Air traffic control for AI agents. Composed authority over complex systems.

---

## Logo: "The Nexus Mark"

The logo represents the core product metaphor — a central monitoring hub overseeing multiple agents.

### Anatomy

- **Central dot (Amber #e8a23e):** The monitor — the command center
- **Three orbital arcs:** Active monitoring connections, fading in opacity to suggest depth
  - Blue arc (#58a6ff) — strongest signal, primary agents
  - Purple arc (#bc8cff) — secondary monitoring layer
  - Cyan arc (#56d4dd) — tertiary/background agents
- **Three agent nodes:** Color-coded dots at arc junctions representing monitored agents
- **Subtle outer ring:** The monitoring scope boundary

### Why This Design

- **Directly represents the product:** Central monitor + orbiting agents
- **Uses the full brand palette:** Each data color has purpose and meaning
- **Scalable:** Works at 16x16 favicon and any larger size
- **Dynamic:** The 3/4 arc gap (missing top-left quadrant) creates movement and suggests active scanning
- **Not generic:** Distinct from typical dashboard/analytics logos

### Usage Rules

- **Minimum size:** 16x16px (favicon), 24x24px recommended minimum
- **Clear space:** Maintain at least 50% of mark width as padding on all sides
- **Dark backgrounds only:** The mark is designed for dark surfaces (#06080d to #1a1f2b)
- **Never stretch, rotate, or recolor individual elements**
- **Never add drop shadows or outer glows to the mark**

### Files

- `public/favicon.svg` — Favicon with dark rounded-rect background
- `public/logo.svg` — Full lockup (mark + wordmark)

---

## Color System

### Primary Brand Color

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Amber Gold** | `#e8a23e` | 232, 162, 62 | Primary accent, CTAs, active states, brand mark center |
| Amber Dim | `rgba(232,162,62,0.10)` | — | Background tints, hover states |
| Amber Medium | `rgba(232,162,62,0.20)` | — | Active tab backgrounds, focus rings |

**Why amber:** Warm, high-energy, stands out against dark navy without being aggressive. Avoids the sea of blue that dominates developer tools. Suggests alertness and precision.

### Background System (Surface Scale)

| Token | Hex | Usage |
|-------|-----|-------|
| `surface-0` | `#06080d` | Page background |
| `surface-1` | `#0c1017` | Card backgrounds, inputs |
| `surface-2` | `#12161f` | Elevated surfaces, hover states |
| `surface-3` | `#1a1f2b` | Active surfaces, modal backdrops |
| `surface-4` | `#232938` | Highest elevation, tooltips |

### Data Colors

Each data color has a semantic role in the monitoring context:

| Name | Hex | Role | Used For |
|------|-----|------|----------|
| **Data Blue** | `#58a6ff` | Primary data | Agent indicators, CPU metrics, primary charts |
| Blue Dim | `rgba(88,166,255,0.12)` | — | Blue-tinted backgrounds |
| **Data Purple** | `#bc8cff` | Secondary data | Session counts, memory metrics |
| Purple Dim | `rgba(188,140,255,0.12)` | — | Purple-tinted backgrounds |
| **Data Cyan** | `#56d4dd` | Tertiary data | Message counts, cost metrics |
| Cyan Dim | `rgba(86,212,221,0.12)` | — | Cyan-tinted backgrounds |

### Status Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Live Green** | `#3fb950` | Connected, running, healthy |
| Live Dim | `rgba(63,185,80,0.12)` | Status backgrounds |
| **Danger Red** | `#f85149` | Errors, disconnected, force kill |
| Danger Dim | `rgba(248,81,73,0.12)` | Error backgrounds |
| **Warning Yellow** | `#d29922` | Warnings, high usage, sidechains |
| Warning Dim | `rgba(210,153,34,0.12)` | Warning backgrounds |

### Border System

| Token | Hex | Usage |
|-------|-----|-------|
| `border-subtle` | `#1a1f2b` | Dividers, section separators |
| `border` (default) | `#252b3b` | Card borders, input borders |
| `border-strong` | `#343c50` | Hover states, focused elements |

---

## Typography

### Primary: Outfit

- **Role:** All UI text, headings, body copy, navigation
- **Weights used:** 300 (light), 400 (regular), 500 (medium), 600 (semi-bold), 700 (bold)
- **Why:** Geometric sans-serif with a modern, technical feel. Excellent legibility at small sizes. The rounded letterforms soften the otherwise austere dark interface.

### Monospace: JetBrains Mono

- **Role:** Metrics, code, timestamps, technical values, keyboard shortcuts
- **Weights used:** 400 (regular), 500 (medium), 600 (semi-bold), 700 (bold)
- **Why:** Purpose-built for code. Tabular figures for aligned numbers. The distinctive character shapes aid quick scanning of metric values.

### Type Scale

| Element | Font | Size | Weight | Tracking |
|---------|------|------|--------|----------|
| Page title | Outfit | 15px | 600 | -0.01em |
| Tab labels | Outfit | 13px | 500 | normal |
| Card headings | Outfit | 14px | 600 | normal |
| Body text | Outfit | 13px | 400 | normal |
| Metric values | JetBrains Mono | varies | 600 | -0.02em |
| Metric labels | JetBrains Mono | 11px | 400 | 0.05em (uppercase) |
| Timestamps | JetBrains Mono | 11px | 400 | normal |
| Keyboard shortcuts | JetBrains Mono | 9px | 500 | normal |
| Hostname / meta | JetBrains Mono | 10px | 400 | 0.05em |

---

## Iconography

### Tab Navigation Icons

Each tab has a dedicated 16x16 SVG icon that reinforces its function:

| Tab | Icon | Metaphor |
|-----|------|----------|
| **Monitor** | Pulse/heartbeat line | Real-time activity, vital signs |
| **Workflows** | Connected nodes | Process flow, dependencies |
| **History** | Clock face | Time-based metrics |
| **Projects** | 2x2 grid | Collection, overview, browsing |

### Icon Design Rules

- **Style:** Stroke-based, 1.5px stroke weight
- **Color:** Inherits from parent text color (currentColor)
- **Size:** 16x16px default, 20x20px for larger contexts
- **Corners:** Rounded line caps and joins
- **Consistency:** Same visual weight across all icons

---

## Visual Effects & Texture

### Surface Treatments

These subtle effects create depth and a "mission control" atmosphere:

| Effect | Purpose | Implementation |
|--------|---------|----------------|
| **Dot grid** | Spatial reference, adds texture to backgrounds | CSS radial-gradient, 24px spacing |
| **Scanlines** | CRT/monitor aesthetic, subtle tech feel | CSS repeating-linear-gradient overlay |
| **Grain** | Film grain texture, prevents flat digital feel | SVG fractalNoise filter overlay |
| **Glass morphism** | Card depth, layered UI feel | backdrop-filter: blur + gradient bg |
| **Glow on hover** | Interactive feedback, draws attention | box-shadow with accent color |

### Animation Principles

- **Duration:** 200-400ms for UI transitions, 2-4s for ambient loops
- **Easing:** ease-out for entrances, ease-in-out for loops
- **Purpose:** Every animation serves a purpose — status indication, state change, or spatial orientation
- **Restraint:** Animations are subtle. The UI should feel alive, not distracting

| Animation | Duration | Usage |
|-----------|----------|-------|
| Fade in | 400ms ease-out | Page content, cards appearing |
| Ring pulse | 2s ease-out infinite | Logo mark, active status indicators |
| Dot pulse | 2s ease-in-out infinite | Connection status dots |
| Header sweep | 4s ease-in-out infinite | Header gradient border |
| Stagger in | 50ms increments | List items cascading in |

---

## Card System

### Anatomy

```
┌──────────────────────────────────┐  ← 1px border (#1a1f2b)
│  ░░░ Glass background ░░░░░░░░  │  ← gradient + blur
│                                  │
│  Content area                    │  ← 20px padding
│                                  │
└──────────────────────────────────┘  ← 12px border-radius
```

### States

| State | Border | Shadow | Transform |
|-------|--------|--------|-----------|
| Default | `#1a1f2b` | none | none |
| Hover | `#252b3b` | none | translateY(-1px) |
| Hover (glow) | `#252b3b` | 0 0 0 1px accent/8, 0 4px 24px -4px black/40 | translateY(-1px) |
| Active/Selected | accent/20 ring | none | none |

---

## Voice & Tone

### Communication Style

- **Labels:** Short, uppercase mono text with letter-spacing (e.g., "SESSIONS", "CPU", "LIVE")
- **Status:** Technical but human (e.g., "just now", "3m ago", not "2026-03-06T20:15:00Z")
- **Errors:** Direct and actionable (e.g., "prompt and cwd are required")
- **Empty states:** Informative, not cute (e.g., "No projects found in ~/.claude/projects/")

### Naming Conventions

- Product: **Claude Agents Monitor** (full), **CAM** (informal/internal)
- Processes: **agents** (not "instances", "workers", or "bots")
- Sub-processes: **subagents** (one word, lowercase)
- UI sections: **tabs** (not "pages" or "screens")
- Metrics: Use standard units (%, MB, $) with monospace formatting

---

## Quick Reference

### Brand Colors (copy-paste)

```
Primary Accent:     #e8a23e
Background:         #06080d
Card Background:    #0c1017
Data Blue:          #58a6ff
Data Purple:        #bc8cff
Data Cyan:          #56d4dd
Live Green:         #3fb950
Danger Red:         #f85149
Warning Yellow:     #d29922
Border Default:     #252b3b
Text Primary:       rgba(255,255,255,0.9)
Text Secondary:     rgba(255,255,255,0.3)
Text Muted:         rgba(255,255,255,0.2)
```

### Fonts (copy-paste)

```css
font-family: 'Outfit', system-ui, sans-serif;       /* UI text */
font-family: 'JetBrains Mono', Menlo, monospace;    /* Metrics */
```
