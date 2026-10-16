# Housely

Organize your shared flat: rotating weekly chores per zone, completion tracking with dates, and a quick link to your Tricount expenses.

## Development

```bash
npm install
npm run dev        # start the dev server
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run typecheck  # TypeScript
```

## Rotation

Assignments are computed, never stored: `member = members[(weekIndex + zoneIndex) % members.length]`.
See `src/domain/rotation.ts`.
