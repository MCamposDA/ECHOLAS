# ECHOLAS

**Evolutionary Comparison and Hierarchical Organization on *Leishmania* Analysis**

A Nextflow DSL2 pipeline that takes raw *Leishmania* short-read sequencing data, calls variants against the *L. braziliensis* M2904 reference, and produces a PCA + maximum-likelihood phylogeny of the input strains. This repo also ships a small **web dashboard** (the `ECHOLAS-standalone.html` you see in the project root) and a **Docker image** so anyone can run the pipeline without installing 10 bioinformatics tools by hand.

\---

## Quick start (Docker)

> One-time install of Docker on Ubuntu — see the dedicated section near the bottom of this README.

From the project root (the folder that contains `main.nf`):

```bash
# 1. Build the image (only the first time, or whenever the Dockerfile changes)
docker compose build

# 2. Start it
docker compose up
```

Open [http://localhost:8080](http://localhost:8080) in your browser. You should see the ECHOLAS dashboard. Click ▶ **run pipeline** and watch the live log.

To stop:

```bash
docker compose down
```

\---

## Pipeline architecture — what each module does and why

The pipeline is split into **5 modules** under `modules/`, plus the orchestrator `main.nf`. Splitting like this means you can re-use a module elsewhere, and Nextflow's caching lets you re-run only the parts that changed.

### Module 1 — `trimming\\\_qc.nf` · Quality control + adaptive trimming

> \\\_Garbage in, garbage out.\\\_ Before alignment we have to make sure each read is real DNA, not adapter, low-quality tail, or PCR junk.

* **`FASTQC\\\_RAW`** — runs FastQC on every input FASTQ. Produces an HTML report and a zipped data file. Tells you base-call quality, GC content, adapter contamination, etc.
* **`FASTQC\\\_PARSE`** — opens the zip and computes the **mean per-base quality** for the file. We use this single number to decide how aggressive trimming should be.
* **`TRIM\\\_PE\\\_CONSERVATIVE` / `\\\_INTERMEDIATE` / `\\\_AGGRESSIVE`** — three flavours of paired-end trimming:

  * mean Q ≥ 30 → conservative (Trimmomatic, gentle thresholds)
  * 25 ≤ Q < 30 → intermediate (fastp, Q25 floor, length 50)
  * Q < 25 → aggressive (fastp, Q30 floor, low-complexity filter on)
* **`TRIM\\\_SE\\\_BASIC` / `\\\_AGGRESSIVE`** — same idea but for single-end reads.
* **`FASTQC\\\_POST`** — re-run FastQC on the trimmed reads so you can compare before/after.

> \\\*\\\*Why adaptive?\\\*\\\* Forcing aggressive trimming on already-clean data throws away good signal; forcing conservative on bad data leaves junk that will cause spurious variant calls downstream.

### Module 2 — `alignment\\\_variant.nf` · Map reads, call variants

* **`INDEX\\\_REF`** — builds the BWA index, the samtools FAI index, and the GATK sequence dictionary for the reference genome. Required by every step that touches the reference.
* **`ALIGN\\\_SORT`** — `bwa mem` aligns each sample against the reference, piped straight into `samtools sort` to produce a coordinate-sorted BAM. The read group `@RG` line embeds the sample name, which GATK needs.
* **`INDEX\\\_BAM`** — produces the `.bai` so downstream tools can random-access the BAM.
* **`BAM\\\_STATS`** — `samtools flagstat` (mapping rates) and `samtools coverage` (per-contig depth). Sanity-check output.
* **`MARK\\\_DUPLICATES`** — Picard finds reads that are PCR duplicates of each other and flags them. Skipping this inflates allele frequencies and breaks variant calling.
* **`HAPLOTYPE\\\_CALLER`** — GATK's per-sample variant caller in `-ERC GVCF` mode. Produces a **gVCF**, which records every position (variant or not) with confidence — necessary for joint genotyping in the next module.
* **`INDEX\\\_GVCF`** — tabix index for the gVCF.

### Module 3 — `genotyping.nf` · Joint calling across all samples

* **`MAKE\\\_GVCF\\\_MAP`** — writes a `sample<TAB>path/to/gvcf` table that GATK needs.
* **`MAKE\\\_INTERVALS`** — extracts the chromosome names from the reference FAI; we'll genotype each.
* **`GENOMICS\\\_DB\\\_IMPORT`** — GATK loads all gVCFs into a GenomicsDB workspace. Faster + scales better than the older `CombineGVCFs` approach.
* **`GENOTYPE\\\_GVCFS`** — finally produces a **joint VCF** with one column per sample and one row per variant site. This is the canonical "raw call set".
* **`CHECK\\\_VCF`** — bcftools dumps the header so you can verify the file is well-formed.

### Module 4 — `variant\\\_filtering.nf` · Clean SNPs + INDELs

We filter twice — once with bcftools (fast, simple) and once with GATK VariantFiltration (using the standard hard-filter expressions for SNPs / INDELs because we don't have a truth set big enough for VQSR).

* **`SNP\\\_EXTRACTION`** — keep only biallelic SNPs.
* **`SNP\\\_FILTER\\\_STRICT`** — drop SNPs with QUAL < 30 or DP < 10.
* **`SNP\\\_FILTER\\\_PCA`** — additionally drop sites where > 10 % of samples are missing a genotype. PCA hates missing data.
* **`SNP\\\_FILTER\\\_PHYLO`** — keep only homozygous-alternate SNPs (`GT="1/1"`). Phylogeny treats each sample as one consensus sequence; ambiguous heterozygotes hurt tree resolution.
* **`SELECT\\\_VARIANTS`** + **`FILTER\\\_SNPS\\\_GATK`** + **`FILTER\\\_INDELS\\\_GATK`** — GATK's recommended hard filters: QD < 2, FS > 60 (SNPs) / 200 (INDELs), MQ < 40, SOR > 3 / 10.
* **`FINAL\\\_MERGE`** — concatenate PASS-only SNPs + INDELs into a single sorted indexed VCF.

### Module 5 — `pca\\\_phylogeny.nf` · The science

* **`RUN\\\_PCA`** — PLINK 1.9 computes eigenvectors, ggplot draws the scatter. Output: `strain\\\_pca.pdf`, `.eigenvec`, `.eigenval`.
* **`PHYLO\\\_SAMPLES\\\_LIST`** — extract the sample order from the VCF.
* **`PHYLO\\\_FASTA\\\_GENERATION`** — for each sample, walk the VCF and write its consensus FASTA per chromosome.
* **`PHYLO\\\_HEADER\\\_FIX`** — normalise FASTA headers so IQ-TREE doesn't choke on weird characters.
* **`PHYLO\\\_CONCAT\\\_CHR`** — concatenate per-chromosome FASTAs into one sequence per sample.
* **`PHYLO\\\_MULTIFASTA`** — combine all samples into a single multi-FASTA alignment.
* **`PHYLO\\\_TREE`** — IQ-TREE GTR+G model with 1000 ultrafast bootstraps and SH-aLRT support. Output: `strain\\\_tree.treefile` + a bootstrap consensus.

\---

## Files in this repo

```
echolas/
├── main.nf                    # the orchestrator — DO NOT EDIT for visualization
├── nextflow.config            # executor + resource defaults
├── modules/                   # the 5 pipeline modules
│   ├── trimming\\\_qc.nf
│   ├── alignment\\\_variant.nf
│   ├── genotyping.nf
│   ├── variant\\\_filtering.nf
│   └── pca\\\_phylogeny.nf
├── scripts/                   # bash + R helpers used by module 5
├── reference/
│   └── GCF\\\_000002845.2\\\_ASM284v2\\\_genomic.fna
├── raw\\\_data/                  # your FASTQ files go here
├── results/                   # generated by Nextflow — not committed
├── ECHOLAS-standalone.html    # the dashboard, single-file
├── Dockerfile                 # recipe for the container
├── docker-compose.yml         # one-line start
├── docker/
│   ├── backend.py             # FastAPI — serves dashboard + runs Nextflow

│   ├── entrypoint.sh
│   └── envs/                  # conda env recipes baked into the image
└── README.md                  # this file
```

\---

## Running natively (without Docker)

If you'd rather skip Docker:

```bash
# Make sure Nextflow + conda are on your PATH, then:
nextflow run main.nf --mode AUTO
```

You can still open `ECHOLAS-standalone.html` directly in a browser to use the dashboard's pipeline visualization and file browser — but the Run button will be in **simulation mode** because there's no backend to call. Use Docker if you want the Run button to actually execute Nextflow.

\---

## Installing Docker on Ubuntu (one-time setup)

```bash
sudo apt remove docker docker-engine docker.io containerd runc
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \\\\
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb \\\[arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \\\\
  https://download.docker.com/linux/ubuntu $(lsb\\\_release -cs) stable" \\\\
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker run hello-world
```

The last line should print "Hello from Docker!". If it does, you're set.

\---

## Tool versions (frozen in the image)

|Tool|Version|
|-|-|
|Nextflow|25.04.2|
|Java (OpenJDK)|17|
|FastQC|0.12.1|
|Trimmomatic|0.40|
|fastp|1.0.1|
|BWA|0.7.18|
|samtools|1.21|
|GATK4|4.6.2.0|
|Picard|3.1.1|
|bcftools|1.19|
|PLINK|1.9|
|IQ-TREE|2.3.6|
|R + ggplot2 / readr / dplyr|latest from conda-forge|



