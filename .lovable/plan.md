

# Fix: Reset "I want to join" state when switching event dates

## Problem
The `joined` and `interestedCount` states in `EventDetailDialog` are initialized once with `useState` and **never reset** when `eventId` changes. When a user clicks a different date in "Upcoming dates", the component re-renders with new event data (title, time, price update correctly because they come from `getEventById`), but the join button state carries over from the previous event. This means:

- If you click "I want to join" on Monday's quiz, then switch to Thursday's quiz, the button still shows "✓ Interested" even though it's a different event occurrence.
- The interested count also carries over incorrectly.

## Solution
Add a `useEffect` that resets `joined` and `interestedCount` whenever `eventId` changes. This ensures each event occurrence has its own clean state. For future backend integration (Supabase), this is the correct place to fetch the real join status per event ID.

## Changes

**`src/components/events/EventDetailDialog.tsx`**:
- Add `useEffect` import
- Add effect watching `eventId` that resets `joined` to `false` and `interestedCount` to `0` (or the event's stored count when a backend exists)

This is a ~5-line fix that ensures the join action always applies to the currently displayed event.

