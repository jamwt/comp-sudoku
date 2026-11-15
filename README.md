# Comp Sudoku

Head-to-head speed sudoku on the web. Two players share one board: a correct
digit claims the cell, a wrong digit locks you out for a few seconds, and the
first player to hold more than half of the open cells wins.

Built with Vite, React, TypeScript, and [Convex](https://convex.dev).

## Layout

| Path                                 | What lives there                                                           |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `convex/gameConfig.ts`               | Every tunable rule: lockout, forfeit timers, rate limits, pool sizes.      |
| `convex/lib/engine.ts`               | Pure rules engine (claims, lockout, clinch, forfeits), tested with Vitest. |
| `convex/lib/sudoku/`                 | Pure generator, solver, and human-technique difficulty grader.             |
| `convex/matches.ts`                  | Match lifecycle: create, join, enter, resign, forfeit checks.              |
| `convex/notes.ts`                    | Private pencil marks, one document per player per match.                   |
| `convex/puzzles.ts`                  | Puzzle pool: seed, cron top-up, Workpool generation, draw.                 |
| `convex/auth.ts`, `src/lib/guest.ts` | Guest sign-in on Convex Auth v2.                                           |
| `src/pages`, `src/game`              | The lobby, board, digit pad, and match screens.                            |

The puzzle solution stays in the `puzzles` table. No query returns it; every
entry is checked against it inside a mutation.

## Deploying

This project uses Convex cloud deployments. The frontend is hosted on the same
deployment by [`@convex-dev/static-hosting`](https://www.convex.dev/components/static-hosting),
which serves `dist/` at `https://<deployment>.convex.site`. The component owns
the site root; any HTTP routes the app adds in `convex/http.ts` are served
under `/api` (`defineApp({ httpPrefix: "/api" })` in `convex/convex.config.ts`).

### A playable preview from your machine

With a **preview deploy key** in `CONVEX_DEPLOY_KEY`, one command deploys the
backend to a preview named after the current branch, seeds its puzzle pool,
builds the frontend against it, uploads `dist/`, and prints the playable URL:

```sh
npm ci
npm run deploy:preview
```

Set `PREVIEW=<name>` to pick another preview name. The command reuses the
preview and keeps its data. `npm run upload:static -- <preview-name>` uploads
an existing `dist/` without redeploying. It wraps the static-hosting CLI,
which can't target a preview deployment by itself.

`puzzles:seed` fills the pool; a cron tops it up every few minutes, and you can
run it by hand with `npx convex run --preview-name <branch> puzzles:seed`.

For a local Vite dev server against the preview instead:

```sh
npx convex deploy \
  --preview-name "$(git branch --show-current)" \
  --cmd 'echo "VITE_CONVEX_URL=$VITE_CONVEX_URL" > .env.local' \
  --cmd-url-env-var-name VITE_CONVEX_URL
npx vite
```

With a **dev deployment** (a Convex account and `npx convex dev`), run
`npm run dev`, which starts `convex dev` and Vite together, and run
`npx convex run puzzles:seed` once.

`convex/_generated` is checked in, because code generation needs a
deployment and CI only has a deploy key.

### Pull request previews

CI's `deploy-preview` job recreates a preview named after the branch (wiping
its data), seeds it, uploads the frontend, and posts the
`https://<preview>.convex.site` URL in the job summary and as a pull request
comment. It skips with a notice when the `CONVEX_DEPLOY_KEY` repository secret
is empty.

### Production

The `Deploy production` workflow runs on every push to `main`. It runs the
tests, deploys the backend, tops up the puzzle pool, and uploads the frontend,
using the `CONVEX_PROD_DEPLOY_KEY` repository secret (a production deploy
key). It skips with a notice when that secret is empty.

## Checks

```sh
npm run typecheck
npm run lint
npm test
```

CI runs all three on every push and pull request. On pull requests it also
deploys a playable preview (see [Pull request previews](#pull-request-previews)).

## Controls

- Move: arrow keys, WASD, or hjkl.
- Enter a digit: 1-9. Notes: Shift+digit, or N to toggle notes mode. Backspace clears a cell's notes.
- Mouse: click a cell, then a digit on the pad.
- Digit-first mode (F): pick a digit, then click cells to place it repeatedly; Enter places it at the cursor.
- Every cell holding the active digit is highlighted.
