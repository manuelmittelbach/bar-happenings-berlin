

## Smart Event Badges — Plan

### Badges (3 only, no emojis)

| Badge | Lucide Icon | Condition | Style |
|-------|-------------|-----------|-------|
| **Happening Now** | `Radio` (pulsing dot) | Event started & not ended (date + startTime/endTime) | Pulsing accent bg, white text |
| **Starts in Xh** | `Clock` | Today, starts within 3h, not live yet | Orange/gold border + text |
| **Popular** | `TrendingUp` | interestedCount > 30 — but **NOT** if event is `featured` (Team Pick) | Pink accent pill |

### Priority & conflict rules
- Max **1 badge** per card (no stacking, no clashing)
- Priority: Live Now > Starting Soon > Popular
- If event has `featured: true` (Team Pick), **skip Popular** entirely — Team Pick already signals quality
- Live Now and Starting Soon are mutually exclusive by definition

### Files

1. **New: `src/lib/eventBadges.ts`**
   - `getEventBadge(event, interestedCount): { label, variant, icon } | null`
   - Parse event date + startTime/endTime vs `new Date()` to determine timing
   - Return the single highest-priority badge or `null`

2. **Edit: `src/components/events/EventCard.tsx`**
   - Call `getEventBadge()` in `useMemo`
   - Render badge as a small pill positioned on the image thumbnail (grid/featured) or inline next to category (list)
   - Style: no rounded corners, `font-mono`, uppercase, tiny text — retro-pop consistent
   - Variant colors: `live` = pulsing accent, `soon` = gold/orange, `popular` = pink
   - Use Lucide icons (`Radio`, `Clock`, `TrendingUp`) — no emojis

