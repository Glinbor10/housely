# Housely

Organize your shared flat: weekly chores that rotate fairly between flatmates, completion tracking with dates, and a quick link to your Tricount expenses. Installable on Android and iOS as a PWA.

## How the rotation works
Assignments are computed, never stored: `member = members[(weekIndex + zoneIndex) % members.length]`.
Adding or removing members or zones never breaks the history. Only completions are stored.
See `src/domain/rotation.ts`.

## Stack
React + TypeScript + Vite + MUI, Firebase (Hosting, Firestore, anonymous Auth), GitHub Actions.

## Environments and delivery
- **PR**: lint, typecheck, tests, build and a Firebase preview channel.
- **Merge to `main`**: verified build deployed to `housely-ci`.
- **Release** (manual workflow): version derived from git tags, deployed to `housely-prod`, GitHub Release created.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and conventions.

## Development
```bash
npm install
npm run dev
npm test
```

## License
MIT, see [LICENSE](LICENSE).

## Roadmap
Tracked in the GitHub milestones and issues of this repository.
