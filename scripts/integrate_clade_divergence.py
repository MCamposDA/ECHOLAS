#!/usr/bin/env python3

"""
================================================================================
INTEGRATE CLADE DIVERGENCE SIGNALS
================================================================================

Author: Matheus Campos Project - Leishmania braziliensis Population Genomics

This script integrates:

1) Window-based diversity statistics (Pi and Tajima's D)
2) Window-based Fst comparisons
3) Genome annotation (GFF)
4) Annotated VCFs per clade

GOAL:
Identify genes that show statistical and genotypic evidence of contributing
to clade divergence.

BIOLOGICAL RATIONALE:
---------------------

Pi (π):
    Measures nucleotide diversity within a clade.
    High π (top 1%) → highly variable regions.
    
Tajima's D:
    Compares segregating sites vs allele frequency spectrum.
    Very negative → possible selective sweep.
    Very positive → possible balancing selection or structure.
    
Fst:
    Measures genetic differentiation between clades.
    High Fst (top 1%) → strong divergence.

Allele Frequency Divergence:
    Variant is considered clade-divergent if:
        AF_clade >= 0.9
        AF_other_clades <= 0.1

FINAL INTERPRETATION:
Genes passing these criteria are candidates for contributing to
clade differentiation in Leishmania braziliensis.

================================================================================
"""

import os
import pandas as pd
import numpy as np
import pysam
from intervaltree import IntervalTree
import argparse

# -------------------------------------------------------------------------
# PARAMETERS
# -------------------------------------------------------------------------

PERCENTILE = 0.99
FIXED_THRESHOLD_HIGH = 0.9
FIXED_THRESHOLD_LOW = 0.1

# -------------------------------------------------------------------------
# STEP 1: LOAD DIVERSITY FILES
# -------------------------------------------------------------------------

def load_window_file(filepath):
    """
    Load vcftools window-based output (pi or TajimaD).
    Automatically detects correct value column.
    """

    df = pd.read_csv(filepath, sep="\t")

    # Normalize column names
    df.columns = [c.strip() for c in df.columns]

    # Detect correct statistic column
    possible_value_cols = ["PI", "TajimaD", "WEIGHTED_FST", "MEAN_FST"]

    value_col = None
    for col in df.columns:
        if col in possible_value_cols:
            value_col = col
            break

    if value_col is None:
        raise ValueError(
            f"Could not detect statistic column in {filepath}. "
            f"Columns found: {df.columns.tolist()}"
        )

    # Standardize column names
    df = df.rename(columns={
        df.columns[0]: "CHROM",
        df.columns[1]: "START",
        df.columns[2]: "END",
        value_col: "VALUE"
    })

    # Remove NA rows
    df = df[df["VALUE"].notna()]

    return df

# -------------------------------------------------------------------------
# STEP 2: IDENTIFY EXTREME WINDOWS
# -------------------------------------------------------------------------

def get_extreme_windows(df):
    upper = df["VALUE"].quantile(PERCENTILE)
    lower = df["VALUE"].quantile(1 - PERCENTILE)

    high = df[df["VALUE"] >= upper]
    low = df[df["VALUE"] <= lower]

    return high, low

# -------------------------------------------------------------------------
# STEP 3: LOAD GFF INTO INTERVAL TREES
# -------------------------------------------------------------------------

def load_gff(gff_file):
    trees = {}
    gene_info = {}

    with open(gff_file) as f:
        for line in f:
            if line.startswith("#"):
                continue
            parts = line.strip().split("\t")
            if parts[2] != "gene":
                continue

            chrom = parts[0]
            start = int(parts[3])
            end = int(parts[4])
            attributes = parts[8]

            gene_id = None
            product = None

            for field in attributes.split(";"):
                if field.startswith("ID="):
                    gene_id = field.replace("ID=", "")
                if "product=" in field:
                    product = field.split("=")[1]

            if chrom not in trees:
                trees[chrom] = IntervalTree()

            trees[chrom][start:end] = gene_id
            gene_info[gene_id] = {
                "chrom": chrom,
                "start": start,
                "end": end,
                "product": product
            }

    return trees, gene_info

# -------------------------------------------------------------------------
# STEP 4: CALCULATE ALLELE FREQUENCIES PER CLADE
# -------------------------------------------------------------------------

def calculate_gene_variants(vcf_path, gene_region):
    vcf = pysam.VariantFile(vcf_path)

    chrom = gene_region["chrom"]
    start = gene_region["start"]
    end = gene_region["end"]

    samples = list(vcf.header.samples)
    variant_counts = {s: 0 for s in samples}
    total_variants = 0

    for record in vcf.fetch(chrom, start, end):
        total_variants += 1
        for sample in samples:
            gt = record.samples[sample]["GT"]
            if gt and any(allele != 0 for allele in gt):
                variant_counts[sample] += 1

    return total_variants, variant_counts

# -------------------------------------------------------------------------
# STEP 5: FIXATION DETECTION
# -------------------------------------------------------------------------

def detect_clade_fixation(allele_freqs):
    divergent_clades = []

    for clade in allele_freqs:
        if allele_freqs[clade] >= FIXED_THRESHOLD_HIGH:
            others = [c for c in allele_freqs if c != clade]
            if all(allele_freqs[o] <= FIXED_THRESHOLD_LOW for o in others):
                divergent_clades.append(clade)

    return divergent_clades

# -------------------------------------------------------------------------
# MAIN PIPELINE
# -------------------------------------------------------------------------

def main(args):

    print("\n[INFO] Loading GFF annotation...")
    gff_trees, gene_info = load_gff(args.gff)

    print("[INFO] Detecting available VCFs...")
    available_vcfs = {}

    for file in os.listdir(args.vcf_dir):
        if file.endswith(".ann.vcf.gz"):
            clade_name = file.replace(".ann.vcf.gz", "")
            available_vcfs[clade_name] = os.path.join(args.vcf_dir, file)

    if not available_vcfs:
        raise RuntimeError("No annotated VCFs found in clade_vcfs directory.")

    print(f"[INFO] VCFs detected for clades: {list(available_vcfs.keys())}")

    results = []

    print("\n[INFO] Starting analysis...\n")

    for clade in os.listdir(args.diversity_dir):

        if clade not in available_vcfs:
            print(f"[WARNING] No VCF found for clade '{clade}'. Skipping.")
            continue

        pi_file = os.path.join(args.diversity_dir, clade,
                               f"{clade}_pi_10kb.windowed.pi")
        taj_file = os.path.join(args.diversity_dir, clade,
                                f"{clade}_tajima_10kb.Tajima.D")

        if not os.path.exists(pi_file) or not os.path.exists(taj_file):
            print(f"[WARNING] Missing diversity files for {clade}. Skipping.")
            continue

        print(f"[INFO] Processing clade: {clade}")

        pi_df = load_window_file(pi_file)
        taj_df = load_window_file(taj_file)

        pi_high, _ = get_extreme_windows(pi_df)
        taj_high, taj_low = get_extreme_windows(taj_df)

        extreme_windows = pd.concat([pi_high, taj_high, taj_low])

        vcf_path = available_vcfs[clade]

        try:
            vcf = pysam.VariantFile(vcf_path)
        except Exception as e:
            print(f"[ERROR] Could not open VCF for {clade}: {e}")
            continue

        for _, row in extreme_windows.iterrows():

            chrom = str(row["CHROM"])
            start = int(row["START"])
            end = int(row["END"])

            if chrom not in gff_trees:
                continue

            if chrom not in vcf.header.contigs:
                print(f"[WARNING] Chromosome {chrom} not in VCF header. Skipping.")
                continue

            overlapping = gff_trees[chrom].overlap(start, end)

            for interval in overlapping:

                gene_id = interval.data
                gene_region = gene_info[gene_id]

                try:
                    total_snps, variant_counts = calculate_gene_variants(
                        vcf_path,
                        gene_region
                    )
                except Exception as e:
                    print(f"[WARNING] Error extracting variants for {gene_id}: {e}")
                    continue

                samples_with_variants = [
                    s for s in variant_counts if variant_counts[s] > 0
                ]

                results.append({
                    "gene_id": gene_id,
                    "product": gene_region["product"],
                    "clade": clade,
                    "chrom": gene_region["chrom"],
                    "start": gene_region["start"],
                    "end": gene_region["end"],
                    "n_snps": total_snps,
                    "samples_with_variants": ",".join(samples_with_variants)
                })

    if not results:
        print("\n[INFO] No candidate genes detected.")
        return

    df_final = pd.DataFrame(results)
    df_final.to_csv("final_candidate_genes.csv", index=False)

    print("\n[INFO] Analysis completed successfully.")
    print("[INFO] Output file: final_candidate_genes.csv")

# -------------------------------------------------------------------------
# ARGPARSE ENTRY POINT
# -------------------------------------------------------------------------

if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description="Integrate diversity statistics with genome annotation and VCF data."
    )

    parser.add_argument(
        "--diversity_dir",
        required=True,
        help="Directory containing clade subfolders with pi and TajimaD outputs."
    )

    parser.add_argument(
        "--vcf_dir",
        required=True,
        help="Directory containing annotated VCFs (*.ann.vcf.gz) per clade."
    )

    parser.add_argument(
        "--gff",
        required=True,
        help="Genome annotation GFF file."
    )

    args = parser.parse_args()

    print("\n============================================================")
    print("INTEGRATE CLADE DIVERGENCE SIGNALS - STARTING")
    print("============================================================")

    main(args)

    print("\n============================================================")
    print("PIPELINE FINISHED")
    print("============================================================")
