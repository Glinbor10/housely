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

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for the workflow and conventions.

## Development

```bash
npm install
npm run dev
npm test
```

## License

[PolyForm Noncommercial 1.0.0](LICENSE): the source is available and free for any noncommercial use. Commercial use and selling the product are reserved to the author.

## Documentation

Project documentation follows a tailored Métrica v3 structure (in English, AsciiDoc): see [docs/README.adoc](docs/README.adoc).

## What it does

- Create a flat (people in rotation order, zones, start date) and share a 6 character invite code
- Weekly rotation where, over a full cycle, every person cleans every zone once, with any number of people and zones
- Mark a zone as done (date defaults to today), real-time for everybody, also offline
- Owner-managed Tricount link and recovery of a flatmate who lost their phone
- Installable on Android and iPhone as a PWA

See the [user manual](docs/implementation/user-manual.adoc) and the [versioning and release procedure](docs/implementation/versioning-and-release.adoc).

## Roadmap

Tracked in the GitHub milestones and issues of this repository.
