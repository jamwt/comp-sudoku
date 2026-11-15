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

## Deploying a backend

This project uses Convex cloud deployments. With a **preview deploy key** in
`CONVEX_DEPLOY_KEY`, deploy the current branch, seed its puzzle pool, and
write the deployment URL for Vite:

```sh
npm ci
npx convex deploy \
  --preview-create "$(git branch --show-current)" \
  --preview-run puzzles:seed \
  --cmd 'echo "VITE_CONVEX_URL=$VITE_CONVEX_URL" > .env.local' \
  --cmd-url-env-var-name VITE_CONVEX_URL
npx vite
```

`--preview-create` recreates the preview from scratch. To push code changes to
the same preview and keep its data, use `--preview-name <branch>` instead.
`puzzles:seed` fills the pool; a cron tops it up every few minutes, and you can
run it by hand with `npx convex run --preview-name <branch> puzzles:seed`.

With a **dev deployment** (a Convex account and `npx convex dev`), run
`npm run dev`, which starts `convex dev` and Vite together, and run
`npx convex run puzzles:seed` once.

`convex/_generated` is checked in, because code generation needs a
deployment and CI only has a deploy key.

## Checks

```sh
npm run typecheck
npm run lint
npm test
```

CI runs all three on every push and pull request. On pull requests it also
deploys a Convex preview named after the branch and builds the frontend
against it, when the `CONVEX_DEPLOY_KEY` repository secret is set.

## Controls

- Move: arrow keys, WASD, or hjkl.
- Enter a digit: 1-9. Notes: Shift+digit, or N to toggle notes mode. Backspace clears a cell's notes.
- Mouse: click a cell, then a digit on the pad.
- Digit-first mode (F): pick a digit, then click cells to place it repeatedly; Enter places it at the cursor.
- Every cell holding the active digit is highlighted.
