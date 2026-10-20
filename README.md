# Housely

Organize your shared flat: weekly chores that rotate fairly between flatmates, completion tracking with dates, and a quick link to your Tricount expenses. Installable on Android and iPhone as a PWA, and it works offline.

## What it does

- Create a flat (people in rotation order, zones, start date) and share a 6 character invite code
- Weekly rotation where, over a full cycle, every person cleans every zone once, with any number of people and zones
- Mark a zone as done (date defaults to today), real-time for everybody, also offline
- Owner-managed Tricount link, and recovery of a flatmate who lost their phone
- Light and dark mode, 44 px touch targets and safe-area support for phones

Computed, not stored: `member = members[(weekIndex + zoneIndex) % members.length]`, so adding or removing people or zones never breaks the history. See `src/domain/rotation.ts`.

See the [user manual](docs/implementation/user-manual.adoc).

## Stack

React + TypeScript + Vite + MUI, Firebase (Hosting, Firestore, anonymous Auth) and GitHub Actions. There is no server of our own: access is enforced by [Firestore security rules](firebase/firestore/firestore.rules), covered by emulator tests.

## Run it locally

You need Node 24 and Java 21 or newer (the Firestore emulator uses it). No credentials are needed: local work runs against the Firebase emulators.

```bash
npm install
npm run dev          # the app and the emulators: http://localhost:5173
npm test             # unit and component tests
npm run test:rules   # emulator tests: rules, data layer and the whole app
npm run e2e          # real-browser tests, with E2E_BASE_URL set to a deployed environment
```

## Delivery

- **PR**: lint, formatting, types, tests with coverage, build, a Firebase preview and real-browser tests on Android (Chromium) and iPhone (WebKit)
- **Merge to `main`**: the same checks, deployed to the CI environment
- **Release** (manual workflow): version derived from git tags, deployed to production, GitHub Release created

See the [versioning and release procedure](docs/implementation/versioning-and-release.adoc).

## Documentation and contributing

Project documentation follows a tailored Métrica v3 structure (English, AsciiDoc): see [docs/README.adoc](docs/README.adoc). The workflow and conventions are in [CONTRIBUTING.md](.github/CONTRIBUTING.md). The roadmap lives in the milestones and issues of this repository.

## License

[PolyForm Noncommercial 1.0.0](LICENSE): the source is available and free for any noncommercial use. Commercial use and selling the product are reserved to the author.
