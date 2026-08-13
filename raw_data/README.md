# `raw_data/`

Put your input FASTQ files here. This is what `main.nf` reads at the start of the pipeline (`raw_data/*.fastq.gz`).

**Naming convention** (used to infer sample name and pair reads):
- Paired-end: `<sample>_1.fastq.gz` / `<sample>_2.fastq.gz` (or `<sample>_R1...` / `<sample>_R2...`)
- Single-end: `<sample>.fastq.gz`

Everything must be gzip-compressed (`.fastq.gz`).

The dashboard's file browser can also move files in and out of `raw_data/_disabled/` to include/exclude a sample from a run without deleting it — that subfolder is a runtime artifact managed by the Docker backend, not something you create by hand.

This folder is gitignored (raw sequencing data doesn't belong in a git repo) — this file is the only thing kept under version control, just so the folder itself exists when you clone the repo.
