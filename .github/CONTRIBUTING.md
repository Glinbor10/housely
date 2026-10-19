# Contributing

## Workflow

1. Open an issue using a template and add it to a milestone.
2. Branch from `main`: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`.
3. Write the failing test first (TDD), then the implementation.
4. Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ci:`).
5. Open a Pull Request with a conventional-commit title and `Closes #N` linking its issue (the `PR title and linked issue` check enforces it; Dependabot only needs the title). `main` is protected: the CI check must pass and nobody pushes directly.
6. Squash and merge. The branch is deleted automatically.

## Code conventions

- Code, comments and commit messages in English.
- React: functional components with hooks, MUI components, props inline, ternaries for conditional rendering, avoid `useEffect`.
- Domain logic stays pure and framework-free (`src/domain`).

## Environments

| Environment | Firebase project | Trigger                                     |
| ----------- | ---------------- | ------------------------------------------- |
| CI          | `housely-ci`     | every merge to `main`                       |
| Production  | `housely-prod`   | manual `Release Action` (approval required) |

PRs get a Firebase preview channel (expires in 7 days).

The Firebase web config (public by design) is injected at build time from the `VITE_FIREBASE_*` variables of each GitHub Environment (`ci`, `production`).

## Local development (new machine checklist)

No credentials or secrets are needed: local work uses the Firebase emulators with fake values committed in `.env.emulators`.

1. Install Node 24 and Java 21 or newer (the Firestore emulator needs it).
2. `git clone` the repository and run `npm install`.
3. Run `npm run dev`: it starts the Auth and Firestore emulators and the app (http://localhost:5173). The emulator panel is at http://localhost:4000, where you can inspect users and documents.
4. Emulator data is wiped when you stop the command. The same Firestore rules as production apply.

To run the app against the real `housely-ci` project instead, create `.env.ci.local` (git-ignored) with the `VITE_FIREBASE_*` values of that project and run `npm run dev:ci`.

## Commands

```bash
npm run dev        # app + Auth and Firestore emulators
npm test           # unit tests
npm run lint       # oxlint
npm run format:check # Prettier
npm run typecheck  # TypeScript
npm run build      # production build
npm run test:rules # emulator tests: Firestore rules, data layer, auth and the whole app (needs Java)
npm run e2e        # real-browser tests on Android (Chromium) and iPhone (WebKit): set E2E_BASE_URL
```

## License

The project uses the PolyForm Noncommercial License 1.0.0. By contributing you agree that your contribution is distributed under that license and that the author keeps the right to use it commercially.
