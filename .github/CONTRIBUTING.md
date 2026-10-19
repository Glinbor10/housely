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

The Firebase web config (public by design) is injected at build time from the `VITE_FIREBASE_*` variables of each GitHub Environment (`ci`, `production`). For local development copy `.env.example` to `.env.local` and fill it with the `housely-ci` values.

## Commands

```bash
npm run dev        # dev server
npm test           # unit tests
npm run lint       # oxlint
npm run format:check # Prettier
npm run typecheck  # TypeScript
npm run build      # production build
npm run test:rules # Firestore rules tests (needs Java for the emulator)
```

## License

The project uses the PolyForm Noncommercial License 1.0.0. By contributing you agree that your contribution is distributed under that license and that the author keeps the right to use it commercially.
