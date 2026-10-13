# library-check-state

State for the daily library-check routine. Not code — never merge into `main`.

- `PROCEDURE.md` — what the routine does each run (its prompt only points here).
- `.last-versions.json` — baseline of upstream versions seen on the last run.
- `YYYY-MM-DD.md` — one report per run; the newest carries the open-items list, the A–G trigger taxonomy and the standing orders for quiet runs.
- `pending-issues/` — drafted findings not yet filed as a PR or issue.

The routine pushes straight to this branch (no PR). Edit `PROCEDURE.md` here to change its behaviour.
