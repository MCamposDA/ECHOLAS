# ECHOLAS

**Evolutionary Comparison and Hierarchical Organization on *Leishmania* Analysis**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Nextflow](https://img.shields.io/badge/nextflow-DSL2-informational.svg)
![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)

A Nextflow DSL2 pipeline that takes raw short-read sequencing data, calls variants against a reference genome, and produces a PCA + maximum-likelihood phylogeny of the input strains. It ships pre-tuned for *Leishmania braziliensis* (M2904, `GCF_000002845.2_ASM284v2`), but the reference genome is a drop-in — any assembly you place in `reference/` is picked up automatically, so the same pipeline works for other *Leishmania* species or other haploid/near-haploid organisms.

On top of the pipeline itself, this repo ships a **web dashboard** (`ECHOLAS-standalone.html`) and a **Docker image**, so you can run the whole thing — trimming, alignment, joint genotyping, filtering, PCA, and tree building — without installing a dozen bioinformatics tools by hand.

---

## Quick start (Docker)

> First time on Ubuntu? See [Installing Docker on Ubuntu](#installing-docker-on-ubuntu-one-time-setup) below.

From the project root (the folder that contains `main.nf`):

```bash
# 1. Add your data (see "Input data" below)
#    - FASTQ files      → raw_data/
#    - reference genome → reference/

# 2. Build the image (first time only, or whenever the Dockerfile changes)
docker compose build

# 3. Start it
docker compose up
```

Open [http://localhost:8080](http://localhost:8080). You'll see the ECHOLAS dashboard — click ▶ **run pipeline** and watch the live log.

```bash
# stop the container
docker compose down
```

---

## Input data

ECHOLAS needs two things before it can run, neither of which is committed to this repo (data doesn't belong in git):

| Folder | What goes there | Details |
|---|---|---|
| `raw_data/` | Your paired/single-end FASTQ files, gzip-compressed | see [`raw_data/README.md`](raw_data/README.md) |
| `reference/` | One reference genome (`.fna`, `.fa`, or `.fasta`) | see [`reference/README.md`](reference/README.md) |

The pipeline fails fast with a clear error if `reference/` has zero or more than one genome file, so there's never ambiguity about which genome was used.

---

## Pipeline architecture — what each module does and why

The pipeline is split into **5 modules** under `modules/`, orchestrated by `main.nf`. Splitting like this means each module can be re-used on its own, and Nextflow's caching lets you re-run only the parts that changed.

### Module 1 — `trimming_qc.nf` · Quality control + adaptive trimming

> *Garbage in, garbage out.* Before alignment we have to make sure each read is real DNA, not adapter, low-quality tail, or PCR junk.

- **`FASTQC_RAW`** — runs FastQC on every input FASTQ. Produces an HTML report and a zipped data file: base-call quality, GC content, adapter contamination, etc.
- **`FASTQC_PARSE`** — opens the zip and computes the **mean per-base quality** for the file. That single number decides how aggressive trimming should be.
- **`TRIM_PE_CONSERVATIVE` / `_INTERMEDIATE` / `_AGGRESSIVE`** — three flavors of paired-end trimming, picked automatically:
  - mean Q ≥ 30 → conservative (Trimmomatic, gentle thresholds)
  - 25 ≤ Q < 30 → intermediate (fastp, Q25 floor, length 50)
  - Q < 25 → aggressive (fastp, Q30 floor, low-complexity filter on)
- **`TRIM_SE_BASIC` / `_AGGRESSIVE`** — same idea for single-end reads.
- **`FASTQC_POST`** — re-runs FastQC on the trimmed reads so you can compare before/after.

**Why adaptive?** Forcing aggressive trimming on already-clean data throws away good signal; forcing conservative trimming on bad data leaves junk that causes spurious variant calls downstream.

### Module 2 — `alignment_variant.nf` · Map reads, call variants

- **`INDEX_REF`** — builds the BWA index, the samtools FAI index, and the GATK sequence dictionary for whichever genome is in `reference/`. Required by every step that touches the reference.
- **`ALIGN_SORT`** — `bwa mem` aligns each sample against the reference, piped straight into `samtools sort` to produce a coordinate-sorted BAM. The `@RG` read group line embeds the sample name, which GATK needs downstream.
- **`INDEX_BAM`** — produces the `.bai` so downstream tools can random-access the BAM.
- **`BAM_STATS`** — `samtools flagstat` (mapping rates) and `samtools coverage` (per-contig depth); a sanity-check output.
- **`MARK_DUPLICATES`** — Picard flags PCR duplicate reads. Skipping this inflates allele frequencies and breaks variant calling.
- **`HAPLOTYPE_CALLER`** — GATK's per-sample variant caller in `-ERC GVCF` mode. Produces a **gVCF**, recording every position (variant or not) with confidence — needed for joint genotyping.
- **`INDEX_GVCF`** — tabix index for the gVCF.

### Module 3 — `genotyping.nf` · Joint calling across all samples

- **`MAKE_GVCF_MAP`** — writes a `sample<TAB>path/to/gvcf` table that GATK needs.
- **`MAKE_INTERVALS`** — extracts contig names from the reference FAI; each is genotyped.
- **`GENOMICS_DB_IMPORT`** — GATK loads all gVCFs into a GenomicsDB workspace (faster and scales better than the older `CombineGVCFs`).
- **`GENOTYPE_GVCFS`** — produces a **joint VCF**, one column per sample, one row per variant site — the canonical "raw call set".
- **`CHECK_VCF`** — bcftools dumps the header so you can verify the file is well-formed.

### Module 4 — `variant_filtering.nf` · Clean SNPs + INDELs

Filtered twice — once with bcftools (fast, simple) and once with GATK `VariantFiltration` using the standard hard-filter expressions (no truth set big enough here for VQSR).

- **`SNP_EXTRACTION`** — keep only biallelic SNPs.
- **`SNP_FILTER_STRICT`** — drop SNPs with QUAL < 30 or DP < 10.
- **`SNP_FILTER_PCA`** — additionally drop sites where > 10% of samples are missing a genotype (PCA hates missing data).
- **`SNP_FILTER_PHYLO`** — keep only homozygous-alternate SNPs (`GT="1/1"`). Phylogeny treats each sample as one consensus sequence; heterozygotes hurt tree resolution.
- **`SELECT_VARIANTS`** + **`FILTER_SNPS_GATK`** + **`FILTER_INDELS_GATK`** — GATK's recommended hard filters: QD < 2, FS > 60 (SNPs) / 200 (INDELs), MQ < 40, SOR > 3 / 10.
- **`FINAL_MERGE`** — concatenates PASS-only SNPs + INDELs into a single sorted, indexed VCF.

### Module 5 — `pca_phylogeny.nf` · The science

- **`RUN_PCA`** — PLINK 1.9 computes eigenvectors, ggplot draws the scatter. Output: `strain_pca.pdf`, `.eigenvec`, `.eigenval`.
- **`PHYLO_SAMPLES_LIST`** — extracts the sample order from the VCF.
- **`PHYLO_FASTA_GENERATION`** — for each sample, walks the VCF and writes a per-sample consensus FASTA (via `scripts/vcf_generate_fasta2.sh`, see [Scripts](#scripts) below).
- **`PHYLO_HEADER_FIX`** — normalizes FASTA headers so IQ-TREE doesn't choke on weird characters.
- **`PHYLO_CONCAT_CHR`** — concatenates per-chromosome FASTAs into one sequence per sample.
- **`PHYLO_MULTIFASTA`** — combines all samples into a single multi-FASTA alignment.
- **`PHYLO_TREE`** — IQ-TREE, GTR+G model, 1000 ultrafast bootstraps + SH-aLRT support. Output: `strain_tree.treefile` plus a bootstrap consensus.

---

## Scripts

`scripts/` holds the bash/Python/R helpers the modules above shell out to, plus a few standalone downstream-analysis tools not wired into `main.nf`:

- **`vcf_generate_fasta2.sh`** — the FASTA-generation script used by `PHYLO_FASTA_GENERATION`. Builds each sample's consensus sequence directly from the genotype matrix (`bcftools query` + a small `awk` encoder), which handles multiallelic sites and missing genotypes (`./.` → `N`) explicitly.
- **`vcf_generate_fasta.sh`** — the earlier, simpler implementation (a thin wrapper around `bcftools consensus`). Kept in the repo for reference; not called by the pipeline.
- **`run_pca.sh`, `plot_pca.R`** — PLINK PCA + ggplot scatter, used by `RUN_PCA`.
- **`fasta_header.adjust.sh`, `concat_chr.sh`** — FASTA header cleanup and per-chromosome concatenation, used by the phylogeny steps.
- **`clade_analyzevcf.py`, `clade_divergence_toolkit.py`, `integrate_clade_divergence*.py`, `functional_clade_stats.py`, `run_diversity_pipeline.py`, `run_fst_pipeline.py`, `generate_final_report.py`** — standalone clade divergence / nucleotide diversity / Fst / reporting utilities for downstream analysis of the pipeline's output VCFs. Run these manually as needed; they aren't part of the automated `main.nf` run.

---

## The dashboard: two HTML files, one purpose

- **`ECHOLAS-standalone.html`** — the production build: a single self-contained file with everything bundled in. This is what the Docker image serves and what most users should open.
- **`ECHOLAS Dashboard.html`** — the source/dev version: a thin HTML shell that loads `components/*.jsx` at runtime via Babel Standalone and React from a CDN. Useful if you're hacking on the UI (`components/App.jsx`, `FileBrowser.jsx`, `PipelineDAG.jsx`, `Results.jsx`, `RunPanel.jsx`) and want changes to show up without a build step — but it needs internet access for the CDN scripts.

Either way, the **Run** button only actually executes Nextflow when the page is served by the Docker backend (`docker/backend.py`); opened directly in a browser, it runs in simulation mode.

---

## Files in this repo

```
ECHOLAS/
├── main.nf                    # orchestrator — wires the 5 modules together
├── nextflow.config            # executor + resource defaults
├── modules/                   # the 5 pipeline modules
│   ├── trimming_qc.nf
│   ├── alignment_variant.nf
│   ├── genotyping.nf
│   ├── variant_filtering.nf
│   └── pca_phylogeny.nf
├── scripts/                   # bash/Python/R helpers (see "Scripts" above)
├── reference/
│   └── README.md              # what to put here — genome itself is gitignored
├── raw_data/
│   └── README.md              # what to put here — FASTQs are gitignored
├── results/                   # generated by Nextflow — not committed
├── components/                # React/JSX source for the dashboard UI
├── assets/                    # logo.png etc.
├── ECHOLAS-standalone.html    # the dashboard, bundled single-file
├── ECHOLAS Dashboard.html     # the dashboard, dev-mode loader
├── Dockerfile                 # recipe for the container
├── docker-compose.yml         # one-line start
├── docker/
│   ├── backend.py             # FastAPI — serves dashboard + runs Nextflow
│   ├── entrypoint.sh
│   └── envs/                  # conda env recipe baked into the image
├── LICENSE                    # MIT
└── README.md                  # this file
```

---

## Running natively (without Docker)

If you'd rather skip Docker, make sure Nextflow + conda are on your `PATH`, then:

```bash
nextflow run main.nf --mode AUTO
```

You can still open `ECHOLAS-standalone.html` directly in a browser to use the dashboard's pipeline visualization and file browser — but the **Run** button will be in simulation mode, since there's no backend to call. Use Docker if you want the Run button to actually execute Nextflow.

---

## Installing Docker on Ubuntu (one-time setup)

```bash
sudo apt remove docker docker-engine docker.io containerd runc
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker run hello-world
```

The last line should print "Hello from Docker!" — if it does, you're set.

---

## Tool versions (frozen in the image)

| Tool | Version |
|---|---|
| Nextflow | 25.04.2 |
| Java (OpenJDK) | 17 |
| FastQC | 0.12.1 |
| Trimmomatic | 0.40 |
| fastp | 1.0.1 |
| BWA | 0.7.18 |
| samtools | 1.21 |
| GATK4 | 4.6.2.0 |
| Picard | 3.1.1 |
| bcftools | 1.19 |
| PLINK | 1.9 |
| IQ-TREE | 2.3.6 |
| R + ggplot2 / readr / dplyr | latest from conda-forge |

---

## License

[MIT](LICENSE) — use it, fork it, build on it. Attribution appreciated.
