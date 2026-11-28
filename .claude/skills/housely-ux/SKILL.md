---
name: housely-ux
description: Design and UX rules for the Housely frontend (React 19, MUI 9, motion, offline-first PWA). Use whenever building, changing or reviewing a screen or component in src/screens or src/components, or when asked to improve the UI, UX, accessibility, empty/loading/error states, navigation, animations or visual consistency of Housely.
---

# Housely UX

Housely is a mobile-first, installable, offline-first PWA used by flatmates, usually one-handed and in a hurry.
Every rule below exists to keep screens consistent. Check the existing code first and match it.

## 1. Product principles

- **What a person acts on goes first; what is only for looking goes after it.** In History the cleanings nobody did are above
  the calendar, and a payment to settle has its button inside its own row.
- **The frequent action takes one tap.** Marking a zone as done is the core action. Never put a form,
  a date picker or a confirmation in front of it. Defaults first (today's date), details behind a secondary control.
- **One primary action per screen or card.** Everything else is secondary (`outlined` or `text`).
  Do not stack several equal-weight buttons: group them (list, "Manage" section) and keep the primary one visually distinct.
- **Show the state, not the plumbing.** Users never see Firebase messages, ISO dates or ids.
- **Offline is normal.** Writes are queued, so the UI must say when something is pending or when the device is offline.
- **The mascot is the brand voice.** Use it (with its moods) for empty states and celebrations, not only on the main card.

## 2. Design system (do not reinvent)

- Use **MUI components with the theme** in `src/theme.ts`. No custom replacements for Button, TextField, Chip, Card, Alert...
- **No loose values.** No hex colors, ad-hoc `px` for spacing/sizing or font sizes in components. Use theme tokens
  (`theme.palette.*`, `theme.spacing`, `theme.shape`, `theme.typography`) and `sx` props.
  The only hex values allowed live in `src/domain/palette.ts` (member colors).
- Touch targets: at least `MIN_TOUCH_TARGET` (44px) from `src/theme.ts`.
- Typography: Nunito Variable via the theme. Headings use the theme weights; do not set `fontFamily` or `fontWeight` by hand.
- Layout: single column, `Stack spacing={2}`, bottom padding that clears the fixed `BottomTabs` (`pb: 12`),
  and `env(safe-area-inset-bottom)` for anything fixed to the bottom. The bar floats over the page, so the theme also sets
  `scroll-padding-bottom` from `TAB_BAR_HEIGHT` and `TAB_BAR_OFFSET`: share those constants, do not repeat the numbers.
- **Color has a meaning.** Red is for an error or something overdue, never for "still to do": a pending zone is a neutral ring.
  "Whose turn" or "yours" uses the primary color. Text on the color of a person goes through `readableOn` (`src/domain/color.ts`):
  white on some palette colors fails 4.5:1.
- Light and dark must both work. Never hardcode a color that only reads well in one scheme.
- Icons come from `src/components/icons.tsx`; add there, do not inline new SVGs in screens.

## 3. React conventions (the same as the rest of the codebase)

- **Avoid `useEffect`.** Use `useSubscription`, `useAction` and event handlers instead. If an effect is truly unavoidable, justify it in a comment.
- **Conditional rendering with ternaries only**: `cond ? <A /> : null`. Never `&&`, never `if` outside the JSX.
- **Props inline** where the component is used. Do not build intermediate objects just to pass them.
- Async user actions go through `useAction` (`busy` and `error` come from there; errors are already humanized by `describeError`).
- Functional components with hooks, explicit prop interfaces, no `any`.

## 4. The four states of every screen

Every view that loads or changes data must define all four, and they must look like they belong together:

1. **Loading**: `Skeleton` shaped like the final content (see `FlatScreen`), with `role="status"` and `aria-busy`. No bare spinners for whole-screen loads.
   A small `CircularProgress` is fine only inside a button or a tiny inline area.
2. **Empty**: mascot (or an icon), one short sentence that says what the user can do, and a button for that action.
   "Nothing to show yet." alone is not an empty state.
3. **Error**: a clear sentence in the user's language plus a way out (retry, go back, leave). Put it next to what failed,
   not at the top of a long list. Never append `error.message` from Firebase to text shown to the user; log it instead.
4. **Offline / pending**: when offline, show it once, globally and discreetly. A write that is queued must not look like it failed.

## 5. Navigation

- The app is a PWA: **the browser/Android back button must do what the user expects**. Sub-views (for example the expenses view
  inside "My flat") and tab changes should be reflected in the history, not only in `useState`.
  Do not add a heavy router for this; keep it small and consistent with the existing code.
- Keep the bottom bar to five sections at most, **always with their name visible** (an icon alone makes people guess; it fits
  down to 320 px in Spanish). Secondary views go inside a section with an explicit back control.
- A title is not repeated: the flat name is the `h1`, the tab bar already says the section, and a section does not start with its own name again.
- Destructive or hard-to-undo actions (release a member, hand over the flat, delete an expense) need a confirmation that names
  the consequence. Prefer an **undo** over a confirmation for cheap, reversible actions.

## 6. Motion

- Use `motion` through `m` components (`LazyMotion` is already set up in `main.tsx`); never import the full `motion` component set.
- Motion explains a change (something appeared, moved, completed). It is never decoration.
- Keep it short: 150-300 ms, no bouncing on lists. Honor reduced motion: `MotionConfig reducedMotion="user"` already covers `motion`;
  for CSS animations add `@media (prefers-reduced-motion: reduce)` like `Mascot` and `ProgressRing` do.
- Confetti and haptics (`celebrate`, `buzz`) are for real achievements only, such as finishing the week, and only after the save succeeded.

## 7. Accessibility (WCAG AA, checked by axe in e2e)

- Contrast 4.5:1 for text, 3:1 for large text and UI. If a MUI default fails, fix it in the theme, not per component.
- Every control has an accessible name. Icon-only buttons need `aria-label`. State is never conveyed by color alone (add text or an icon).
- Visible focus, logical order, and full keyboard use. Focus is never hidden behind the floating bar (WCAG 2.2, 2.4.11).
- **Headings do not skip a level.** The flat is the `h1`, a section or a zone is an `h2`: use `variant` for the look and `component` for the level.
- **Focus has a life cycle.** A form or view that opens in place of a button moves the cursor into itself (the first field of a short form;
  the title, with `tabIndex={-1}`, when a phone keyboard must not pop up) and gives it back to the button when it closes. Do it with a
  ref callback that is defined once (`RotationEditor`, `ExpensesView`), not with `useEffect`. A MUI `Dialog` already does it.
- Dynamic messages (saved, error) use `role="status"` / `role="alert"` as appropriate.
- Forms: visible labels, `helperText` for rules, inline validation next to the field, correct `type` and `inputMode`
  so mobile shows the right keyboard. **Each error goes on its own field** (`error` plus `helperText`, so it is read with the field);
  a banner is only for what no field owns, such as a failed save (`ExpenseForm`).

## 8. Text and i18n

- **No hardcoded user-facing strings**, including titles saved to the database and `aria-label`s. Everything goes through `t()`.
- Spanish and English must both fit: leave room for text that is 30-40% longer and never truncate meaning.
- Dates and money go through locale formatting (`Intl`), never raw ISO strings or manual `toFixed`.
- Add every new text to both `src/i18n/en.ts` and `src/i18n/es.ts` (they are edited by hand in this project) and keep the keys in the same order.

## 9. Workflow for any UI change

1. Read the neighbors first: the closest existing screen/component, `src/theme.ts` and `src/components/icons.tsx`.
2. Write the failing test first (TDD): a Testing Library test for behavior, and update the Playwright test in `e2e/` if a flow changes.
3. Implement with the rules above. Keep the change small and reversible.
4. Verify:
   - `npm run lint`, `npm run typecheck`, `npm test`.
   - Look at it at **360 px and 768 px wide, light and dark** (Playwright screenshots or `npm run screenshots`).
   - Run the axe e2e check for the touched screen.
   - To judge what the floating bar covers, measure in a real viewport scrolled to the end: a `fullPage` screenshot draws a fixed element in the middle of the image.
   - After a layout change run the whole `npm run e2e:emulator`: an element that lands in the band under the bar can make a test fail (this happened with the delete button of an expense).
5. Report what changed, what you verified and what you did not.

## 10. Quick review checklist

- [ ] Main action reachable in one tap, one clear primary button
- [ ] Loading, empty, error and offline states all handled
- [ ] No hex, loose px, hardcoded text or raw ISO date
- [ ] No `useEffect`, no `&&` in JSX, props inline
- [ ] Back button behaves, destructive actions confirmed or undoable
- [ ] Contrast, labels, focus and reduced motion checked
- [ ] Red only for error or overdue; headings in order; each error on its field; focus goes in and comes back
- [ ] Works in ES and EN, light and dark, 360 px
