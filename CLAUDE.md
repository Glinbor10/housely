# Housely — project guide for Claude

## Language

- **Communicate** with the user in Spanish.
- **Code, comments, commit messages, PR titles and bodies, issue text**: English only.

## Git workflow

- Never commit directly to `main`. Always branch → PR → squash merge.
- Never force-push. Never `git reset --hard`. Never `git rebase -i` on a shared branch.
- Never create a release or deploy to production unless explicitly asked.

## Conventions

- Conventional commits (`feat:`, `fix:`, `chore:`, etc.). Squash merges only.
- No AI attribution anywhere: no "Generated with Claude Code" line in PR bodies and no `Co-Authored-By` trailer for an AI in commits. When squash merging, write the body by hand so no trailer reaches `main`.
- PR title must follow conventional commit format and reference the linked issue (`Closes #NNN`).
- Free tier only — Firebase Spark. No paid services without explicit approval.

## Testing rules

### E2E tests must travel with navigation changes

When any of the following change, update `e2e/` in the **same PR**:

- Tab names or order (`BottomTabs.tsx`, the `Tab` type, i18n tab keys)
- Route definitions or hash-based navigation
- Any text string that an e2e test asserts on (check `e2e/` for the old string before renaming)

**Why this rule exists:** PR #223 renamed the "My flat" tab into three tabs (People, Expenses,
Settings). The e2e spec was not updated, which broke all browser tests on main and required a
separate hotfix PR. The same applies to any renamed i18n key that appears in a `getByText` call.

**How to check:** before opening a PR that touches tabs or i18n, run:

```
grep -r "openTab\|getByText\|getByRole\|getByLabel" e2e/
```

and verify every string still matches the new UI.

## Design review with Impeccable

The [Impeccable](https://github.com/pbakaus/impeccable) design skill (Apache-2.0) is in `.claude/skills/impeccable/` and its agents in `.claude/agents/`. It is third party code: do not edit it, and it is left out of prettier and lint. Its engine binary (`scripts/bin/`) is not versioned: the launcher downloads it and checks it against `scripts/engine-checksums.txt` the first time it runs.

Use it before a release or after a redesign, not on every PR. `/impeccable critique <screen>` and `/impeccable audit <screen>` review the app, and `npx impeccable detect <url or folder>` is the deterministic detector (no model needed).

Rules learned the hard way:

- **Verify every finding before changing code.** The agents review from screenshots and may have opened only part of them. Screenshots of a full page (`fullPage`) draw a fixed element, like the tab bar, in the middle of the image: it is not a bug. Measure with a real viewport, scrolling to the end.
- Do not use `/impeccable live`: it can start `claude` or `codex` with the permission checks turned off.
- `npx impeccable update` rewrites the skill: review the diff before committing it.
- The e2e config reuses a server that is already on port 4173 (`reuseExistingServer`): if a test run is cut short, stop that `vite preview` or the next run tests an old build.
