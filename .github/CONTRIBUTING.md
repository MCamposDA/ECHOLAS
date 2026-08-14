# Contributing to ECHOLAS

Thanks for considering a contribution. This is a small research pipeline, so
the process is intentionally lightweight.

## Reporting bugs

Open an [Issue](../../issues/new/choose) using the **Bug report** template.
The more specific you are about how you ran the pipeline (Docker vs native),
what data you used, and what you saw in the logs, the faster it can be
diagnosed.

## Suggesting features

Open an Issue using the **Feature request** template. Explain the problem
you're trying to solve, not just the solution you have in mind — there may
already be a simpler path through the existing modules/scripts.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you're expected to uphold it.

## Development setup

There's no separate dev environment — you run the actual pipeline:

```bash
# Docker (recommended, everything pinned)
docker compose build
docker compose up

# or natively, if you already have Nextflow + conda on PATH
nextflow run main.nf --mode AUTO
```

See the [README](../README.md) for what goes in `raw_data/` and `reference/`
before either of these will do anything useful.

## Project conventions

- **One Nextflow process per pipeline step**, grouped into the 5 modules
  under `modules/` (trimming/QC, alignment/variant calling, genotyping,
  variant filtering, PCA/phylogeny). If you're adding a step, put it in the
  module it logically belongs to rather than creating a new one, unless it's
  a genuinely new stage.
- **Shell/Python/R helpers live in `scripts/`** and are invoked from inside
  a process via `bash $script_name ...` (the script is passed in as a
  Nextflow `path` input, not hardcoded). Follow that pattern for new helper
  scripts so Nextflow tracks them for caching/re-runs.
- **No hardcoded sample- or species-specific filenames** in `modules/*.nf` —
  see how the reference genome is resolved via a glob over `reference/`
  instead of a fixed filename. Anything pipeline-specific belongs in
  `raw_data/`/`reference/` (gitignored), never committed.
- **Tool versions are pinned** in `docker/envs/echolas.yml`. If your change
  needs a new tool or a version bump, update that file (and the version
  table in the README) rather than relying on whatever's on your `PATH`.

## Testing your change

There's no automated test suite today — **the test is running the actual
pipeline** end-to-end (or at least through the module(s) you touched) with
real or representative data, via one of the two methods above. Please
describe what you ran in your Pull Request (see the PR template) rather than
just asserting it works.

## Pull requests

1. Fork the repo and branch off `main`.
2. Keep the PR focused — one fix/feature per PR is easier to review than a
   bundle of unrelated changes.
3. Fill out the PR template, including what you actually ran to test it.
4. Update `README.md` if you changed anything user-facing (a new module
   step, a changed input requirement, a new tool version).
