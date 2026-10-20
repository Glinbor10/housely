# Security Policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub private vulnerability reporting instead: Security tab, then "Report a vulnerability".

Housely is maintained by one person: you can expect an acknowledgement within a few days and a fix or a mitigation for confirmed issues as soon as it is practical.

## What is not a secret

The Firebase web configuration (API key, project id, app id) is public by design and is restricted by domain. Access to the data is enforced by the Firestore security rules in `firebase/firestore/firestore.rules`, which have their own test suite. Reports about those rules are very welcome.

## Secrets

Never commit secrets: the Firebase service accounts live in GitHub Secrets only.
