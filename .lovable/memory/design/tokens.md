---
name: Barlin Design Tokens
description: Full color system, typography, and component patterns for Barlin minimal black/white/orange design
type: design
---

## Colors
- Background: 30 20% 96% (warm off-white)
- Foreground: 0 0% 7% (near black)
- Card: 0 0% 100% (white)
- Accent/Orange: 18 80% 50% (burnt orange)
- Muted: 30 10% 93%
- Border: 0 0% 85%

## Typography
- Headings: Bebas Neue (condensed, uppercase, italic via CSS)
- Body: DM Sans
- Mono/Labels: Space Mono
- Editorial/Italic: Playfair Display (used for "tonight" style accents)

## Component Patterns
- Buttons: bg-foreground text-background (primary), bg-accent text-white (CTA)
- Cards: border border-border, hover:border-foreground
- Pills/Filters: font-mono uppercase, active = bg-foreground text-background
- No rounded corners anywhere (--radius: 0px)
- Marquee banner: bg-foreground text-background
- heading-display class: font-heading + uppercase + italic
