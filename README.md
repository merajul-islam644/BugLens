# BugLens

Find the signal. Explain the bug.

BugLens is where a team keeps the evidence, the observed facts, the written reproduction steps and
the outcome of the retest — one place per defect.

## Running it

```bash
npm install
npm run cert   # first run only: a local certificate for the app's own domain
npm run dev
```

The `.env` at the repository root points the app at its own environment. Only public
`VITE_*` values belong there.

## What is here

- **Projects** — the applications BugLens records defects against, each with the environments it runs in.
- Members sign in on the hosted sign-in page; a member's role decides what they may change.
