---
name: housely-firebase
description: Backend rules for Housely (Firebase Spark, Firestore, Auth, App Check, Hosting). Use whenever changing firestore.rules, rules.test.ts, firestore.indexes.json, src/firebase/*, the data model, the Firebase emulators, the CI deploy of rules or anything about quotas, App Check or security of the data.
---

# Housely Firebase

There is **no server code**: no Cloud Functions, no admin SDK. The backend is Firestore plus its security rules, so
`firebase/firestore/firestore.rules` _is_ the business logic that cannot be trusted to the client. Check the existing
code first and match it.

## 1. Where things are

- `firebase/firestore/firestore.rules` and `rules.test.ts`: the rules and their tests (emulator). `firestore.indexes.json`: indexes (empty today).
- `firebase/firebase.json`: emulators (auth 9099, firestore 8080, UI 4000) and the Hosting headers, **including the Content-Security-Policy**.
- `src/firebase/`: `app.ts` (init, offline cache, App Check, emulators), `config.ts` (env variables), `flatRepository.ts` (every read and write), plus Google sign-in and the transfer of a member to a Google account.
- `docs/design/data-model.adoc`: the model and the access rules in words. `docs/design/adr/0003-identity-by-name.adoc`: why identity is a picked name.
- `src/domain/`: pure logic (expenses, settlements, rotation, palette). The UI never imports `firebase/firestore`: it goes through `flatRepository`.

## 2. The model in five lines (do not re-derive it)

- A flat is called a **home** in the app; the collection keeps the name `flats`.
- The zone assignment is **computed**, not stored: `members[(week + zoneIndex) % memberCount]`. Only data that cannot be derived is stored.
- Ids carry the rules: completions, settlements and takeovers use `{weekIndex}_{zone}` (one per zone and week); members are `m0` to `m19` and must match `order`, because a rule cannot count a collection; layouts use `fromWeek`.
- Money is whole cents (`amountCents`). Balances and payments to settle are computed in `src/domain/expenses.ts`.
- Identity is anonymous by default. **Creating a home needs Google** (`hasGoogle()` reads the `identities` claim); only a member with `hasGoogle` can become owner, so a home always keeps someone who can recover their account.

## 3. Conventions of the rules

- Helpers at the top (`signedIn`, `isMember`, `memberIdOf`, `isOwner`, `isOwnerAfter`, `isDeletingFlat`) and one `isValid*` shape function per document: `hasOnly` plus `hasAll` on the keys, text lengths, `YYYY-MM-DD` dates by regex, optional fields as `!('x' in data) || ...`.
- **The server decides what time it is.** `currentWeekIndex` is computed from `request.time` in UTC, so the phone clock cannot say a week is over.
- Rules cannot count or list: caps come from id conventions (`m0`..`m19`, 20 zones, week up to 1040) and from counters (`owners/{uid}.flatCount`, at most 3 homes; a home is created in a batch that raises it by exactly one).
- `isOwnerAfter` and `getAfter` are for writes that create several documents in one batch.
- **Every `get()`, `exists()` and `getAfter()` in a rule is a billed read, even when the request is rejected.** Firestore allows 10 of these calls per request, 20 for a batch or a transaction (and 10 for each operation inside it); a call on a document that was already read is cached and does not count toward that limit. A flat of 20 people is created in one batch and passes (a test in `rules.test.ts` keeps it so). The rules are 28 KB of the 256 KB the source may have.
- Deleting a home: the owner marks it with `deleting` first; only then can everything under it be removed. Without the mark, clients never delete a home.
- Invite codes can be read, not listed. Member names are readable by any signed-in user on purpose (a joiner picks theirs); the home id is random and comes only from the code.
- The member colors are written in the rules **and** in `src/domain/palette.ts`: change both. `rules.test.ts` compares them.
- Anonymous identities are free, so the limits stop accidents, not attackers. The real protection against abuse is App Check and watching the quota.

## 4. Changing the backend: checklist

1. Write the **rules tests first** (`rules.test.ts`): what is allowed, and what is denied for a stranger, a plain member and a non-owner. Never loosen a rule to make a test pass.
2. Change `firestore.rules`: shape function, then permission, as narrow as possible.
3. `npm run test:rules` (starts the emulators; needs Java).
4. `flatRepository.ts`: several documents that must go together use `writeBatch` (the rules check them with `getAfter`); times use `serverTimestamp()`; where a stale cache would be wrong (counters, deleting a home) use `getDocFromServer` or `getDocsFromServer`.
5. Reads: keep them cheap. History is windowed (`HISTORY_WINDOW`, 26 weeks) and expenses are subscribed only when the tab is first opened.
6. A compound query with a range comparison, or one that sorts by a different field than it filters, needs a manual (composite) index in `firestore.indexes.json`; it is deployed with the rules. Without it Firestore returns an error with a link to create it.
7. A new Firebase service or domain also needs the Content-Security-Policy in `firebase.json` (`connect-src`, `script-src`, `frame-src`).
8. Update `docs/design/data-model.adoc`, `scripts/seed.mjs` (demo data) and the i18n texts of any new error (`describeError`).

## 5. Environments and gotchas

- **Spark plan only, free.** No paid services, no Cloud Functions, no TTL policy (removed in #246: Spark does not allow it, and the Firebase docs give TTL deletes no free usage).
- **The free quota of Firestore** (Firebase docs, "Usage and limits"): 1 GiB stored, 50,000 reads, 20,000 writes and 20,000 deletes **per day**, 10 GiB of outbound data per month, and one free database per project. The docs disagree on what happens when it runs out: the quotas page says it resets daily around midnight Pacific time, while the Spark pricing page says that exceeding a no-cost limit in a calendar month shuts that product off for the rest of the month. Assume the worse case and do not add reads lightly.
- **Never link a Cloud Billing account or use a paid Google Cloud service in these projects:** the Firebase docs say either one upgrades the project to Blaze automatically. The projects are `housely-ci` and `housely-prod`, each with one `(default)` database (Firestore Native, Standard edition).
- **Rules and indexes are deployed by CI, and a pull request deploys them to the CI Firebase project before it is merged** (when `FIRESTORE_DEPLOY_ENABLED` is true and the PR is from this repository). `merge-main` deploys to CI again and the release deploys to production. The `rules` job runs in parallel, so run `npm run test:rules` yourself first: a bad rule is live in CI while its PR is open.
- **Hosting on Spark:** 10 GB of storage and 10 GB of transfer a month for the whole project. Over the storage you cannot deploy; over the transfer the sites are disabled until the next month, after a short grace period. A file can be 2 GB at most.
- **Auth:** new accounts, anonymous ones included, are limited to 100 an hour per IP address. **Never enable the automatic clean-up of anonymous accounts** (it needs Identity Platform and deletes them after 30 days): a flatmate without Google would lose their member.
- **The database location cannot be changed** once created: both projects use `eur3` (Belgium and Netherlands), Firestore Native, Standard edition. On 2026-11-13 both had point-in-time recovery off and there are no backups (they need Blaze), so deleted data cannot be recovered. Point-in-time recovery needs billing enabled and has no free tier (it is charged per GiB a month of PITR data); it keeps 7 days of versions instead of 1 hour. Delete protection (`firebase firestore:databases:update "(default)" --delete-protection ENABLED --project <id>`) was on in `housely-ci` and still off in `housely-prod`.
- **App Check** uses reCAPTCHA Enterprise (`VITE_APPCHECK_SITE_KEY`). It is off without a key and with the emulators. It only blocks requests once it is **enforced** per service (pending, #95); until then it only measures. reCAPTCHA Enterprise is no-cost for 10,000 assessments a month (each token refresh is one, twice an hour while the app is open) and the auto refresh must be switched on, as `app.ts` does. On Spark only four score thresholds are offered.
- **The web config and its key are public by design**; what protects the project is the rules, App Check and the API restrictions of the key.
- The web config (`VITE_FIREBASE_*`) is public by design and injected at build time; if a variable is missing the app throws on purpose. Service accounts live only in GitHub secrets.
- Local work: `npm run dev` (emulators + app), `npm run dev:seed` (demo data: `guille@demo.com`, `carla@demo.com`, `marta@demo.com`), `npm run e2e:emulator`. The emulated Google popup is timing sensitive, so a few e2e tests are flaky on slow machines.
- The e2e config reuses a server that is already on port 4173: if a run is cut short, stop that `vite preview` or the next run tests an old build.
- The Firebase tools are pinned (`firebase-tools@15.34.0` in the scripts and in the workflows): change them together.

## 6. Do not

- Read or write Firestore from a component or a screen.
- Edit data by hand in the console to "fix" a bug without saying so in the issue.
- Put a service account, a token or a private key in the repository.
- Add a paid service or a Cloud Function without asking first.
- Trust a value from the client that the rules can work out (time, week, counters, who the author is).

## 7. Official sources (checked on 2026-11-13)

The Firebase pages show no date, so check them again before relying on a number. In particular, the quota pages disagree with each other (see section 5).

- Firestore limits and free quota: https://firebase.google.com/docs/firestore/quotas
- Spark and Blaze plans: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Budgets and spend caps: https://firebase.google.com/docs/projects/billing/avoid-surprise-bills
- Backups and managed export (both need Blaze): https://firebase.google.com/docs/firestore/backups
- Access calls and billing of rules: https://firebase.google.com/docs/firestore/security/rules-conditions
- Locations: https://firebase.google.com/docs/firestore/locations
- Hosting quotas: https://firebase.google.com/docs/hosting/usage-quotas-pricing
- Auth limits and anonymous accounts: https://firebase.google.com/docs/auth/limits and https://firebase.google.com/docs/auth/web/anonymous-auth
- App Check with reCAPTCHA Enterprise: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- API keys: https://firebase.google.com/docs/projects/api-keys
