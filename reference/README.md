# `reference/`

Put your reference genome here. ECHOLAS is not tied to any single species — drop in whichever assembly you're calling variants against.

**What goes here:**
- One genome FASTA: `*.fna`, `*.fa`, or `*.fasta`.

That's it — everything else (BWA index, `.fai`, sequence dictionary) is generated automatically by the pipeline's `INDEX_REF` step and never committed.

**Rules the pipeline enforces:**
- Exactly one `.fna`/`.fa`/`.fasta` file must be present, or the run fails fast with a clear error (no reference found / more than one reference found — ambiguous).
- The genome you use here must match what you actually want to call variants against; ECHOLAS ships pre-tuned for *Leishmania braziliensis* M2904 (`GCF_000002845.2_ASM284v2`), but any haploid/near-haploid reference genome works.

Example — fetching the default *L. braziliensis* M2904 reference from NCBI:

```bash
curl -o reference/GCF_000002845.2_ASM284v2_genomic.fna.gz \
  "https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/002/845/GCF_000002845.2_ASM284v2/GCF_000002845.2_ASM284v2_genomic.fna.gz"
gunzip reference/GCF_000002845.2_ASM284v2_genomic.fna.gz
```

Everything else in this folder is gitignored so the repo stays small — this file is the only thing kept under version control.
