#!/usr/bin/env python3

"""
================================================================================
INTEGRATE CLADE DIVERGENCE SIGNALS – v2.0
================================================================================

Extended version of v1.0
Adds:
    - n_pi_high
    - n_tajima_high
    - n_tajima_low
    - n_extreme_windows
    - snp_density
    - variant_frequency
    - clade_specificity
    - divergence_class
    - evidence_score
    - window_signal_details

Maintains:
    - One line per gene per clade
    - Mandatory VCF usage
    - Exact directory structure
================================================================================
"""

import os
import pandas as pd
import numpy as np
import pysam
from intervaltree import IntervalTree
import argparse

PERCENTILE = 0.99
FIXED_THRESHOLD_HIGH = 0.9
FIXED_THRESHOLD_LOW = 0.1


# -------------------------------------------------------------------------
# LOAD WINDOW FILE
# -------------------------------------------------------------------------

def load_window_file(filepath):
    df = pd.read_csv(filepath, sep="\t")
    df.columns = [c.strip() for c in df.columns]

    value_col = None
    for col in df.columns:
        if col in ["PI", "TajimaD"]:
            value_col = col
            break

    if value_col is None:
        raise ValueError(f"Statistic column not found in {filepath}")

    df = df.rename(columns={
        df.columns[0]: "CHROM",
        df.columns[1]: "START",
        df.columns[2]: "END",
        value_col: "VALUE"
    })

    df = df[df["VALUE"].notna()]
    return df


# -------------------------------------------------------------------------
# EXTREME WINDOWS
# -------------------------------------------------------------------------

def get_extreme_thresholds(df):
    upper = df["VALUE"].quantile(PERCENTILE)
    lower = df["VALUE"].quantile(1 - PERCENTILE)
    return upper, lower


# -------------------------------------------------------------------------
# LOAD GFF
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
                "product": product,
                "length": end - start
            }

    return trees, gene_info


# -------------------------------------------------------------------------
# VARIANT CALCULATION
# -------------------------------------------------------------------------

def calculate_gene_variants(vcf, gene_region):
    chrom = gene_region["chrom"]
    start = gene_region["start"]
    end = gene_region["end"]

    samples = list(vcf.header.samples)
    total_variants = 0
    variant_samples = set()

    for record in vcf.fetch(chrom, start, end):
        total_variants += 1
        for sample in samples:
            gt = record.samples[sample]["GT"]
            if gt and any(a != 0 for a in gt):
                variant_samples.add(sample)

    variant_frequency = len(variant_samples) / len(samples) if samples else 0

    return total_variants, variant_frequency


# -------------------------------------------------------------------------
# MAIN
# -------------------------------------------------------------------------

def main(args):

    print("\n[INFO] Loading GFF...")
    gff_trees, gene_info = load_gff(args.gff)

    print("[INFO] Detecting VCFs...")
    vcfs = {}
    for file in os.listdir(args.vcf_dir):
        if file.endswith(".ann.vcf.gz"):
            clade = file.replace(".ann.vcf.gz", "")
            vcfs[clade] = os.path.join(args.vcf_dir, file)

    if not vcfs:
        raise RuntimeError("No annotated VCFs found.")

    print(f"[INFO] VCFs found for: {list(vcfs.keys())}")

    results = []

    for clade in os.listdir(args.diversity_dir):

        if clade not in vcfs:
            print(f"[WARNING] No VCF for {clade}. Skipping.")
            continue

        pi_file = os.path.join(args.diversity_dir, clade,
                               f"{clade}_pi_10kb.windowed.pi")
        taj_file = os.path.join(args.diversity_dir, clade,
                                f"{clade}_tajima_10kb.Tajima.D")

        if not os.path.exists(pi_file) or not os.path.exists(taj_file):
            print(f"[WARNING] Missing diversity files for {clade}. Skipping.")
            continue

        print(f"[INFO] Processing {clade}")

        pi_df = load_window_file(pi_file)
        taj_df = load_window_file(taj_file)

        pi_high, _ = get_extreme_thresholds(pi_df)
        taj_high, taj_low = get_extreme_thresholds(taj_df)

        vcf = pysam.VariantFile(vcfs[clade])

        gene_stats = {}

        for _, row in pi_df.iterrows():
            chrom = str(row["CHROM"])
            start = int(row["START"])
            end = int(row["END"])
            value = row["VALUE"]

            if value >= pi_high and chrom in gff_trees:
                overlaps = gff_trees[chrom].overlap(start, end)
                for interval in overlaps:
                    gene_id = interval.data
                    gene_stats.setdefault(gene_id, {
                        "n_pi_high": 0,
                        "n_tajima_high": 0,
                        "n_tajima_low": 0,
                        "signals": []
                    })
                    gene_stats[gene_id]["n_pi_high"] += 1
                    gene_stats[gene_id]["signals"].append(f"PI={round(value,3)}")

        for _, row in taj_df.iterrows():
            chrom = str(row["CHROM"])
            start = int(row["START"])
            end = int(row["END"])
            value = row["VALUE"]

            if chrom not in gff_trees:
                continue

            overlaps = gff_trees[chrom].overlap(start, end)
            for interval in overlaps:
                gene_id = interval.data
                gene_stats.setdefault(gene_id, {
                    "n_pi_high": 0,
                    "n_tajima_high": 0,
                    "n_tajima_low": 0,
                    "signals": []
                })

                if value >= taj_high:
                    gene_stats[gene_id]["n_tajima_high"] += 1
                    gene_stats[gene_id]["signals"].append(f"TajimaHigh={round(value,3)}")

                if value <= taj_low:
                    gene_stats[gene_id]["n_tajima_low"] += 1
                    gene_stats[gene_id]["signals"].append(f"TajimaLow={round(value,3)}")

        for gene_id in gene_stats:

            region = gene_info[gene_id]

            total_snps, variant_frequency = calculate_gene_variants(
                vcf, region
            )

            snp_density = total_snps / region["length"] if region["length"] > 0 else 0

            n_extreme = (
                gene_stats[gene_id]["n_pi_high"] +
                gene_stats[gene_id]["n_tajima_high"] +
                gene_stats[gene_id]["n_tajima_low"]
            )

            evidence_score = n_extreme

            divergence_class = "LOW"
            if evidence_score >= 5:
                divergence_class = "HIGH"
            elif evidence_score >= 2:
                divergence_class = "MODERATE"

            results.append({
                "gene_id": gene_id,
                "product": region["product"],
                "clade": clade,
                "chrom": region["chrom"],
                "start": region["start"],
                "end": region["end"],
                "gene_length": region["length"],
                "n_pi_high": gene_stats[gene_id]["n_pi_high"],
                "n_tajima_high": gene_stats[gene_id]["n_tajima_high"],
                "n_tajima_low": gene_stats[gene_id]["n_tajima_low"],
                "n_extreme_windows": n_extreme,
                "window_signal_details": ";".join(gene_stats[gene_id]["signals"]),
                "n_snps": total_snps,
                "snp_density": snp_density,
                "variant_frequency": variant_frequency,
                "evidence_score": evidence_score,
                "divergence_class": divergence_class
            })

    if not results:
        print("[INFO] No candidate genes detected.")
        return

    df = pd.DataFrame(results)

    gene_counts = df.groupby("gene_id")["clade"].nunique()
    df["n_clades_detected"] = df["gene_id"].map(gene_counts)
    df["clade_specificity"] = df["n_clades_detected"].apply(
        lambda x: "CLADE_SPECIFIC" if x == 1 else "SHARED"
    )

    df = df.sort_values("evidence_score", ascending=False)
    df.to_csv("final_candidate_genes_v2.0.csv", index=False)

    print("\n[INFO] Analysis completed.")
    print("[INFO] Output: final_candidate_genes_v2.0.csv")


# -------------------------------------------------------------------------

if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--diversity_dir", required=True)
    parser.add_argument("--vcf_dir", required=True)
    parser.add_argument("--gff", required=True)

    args = parser.parse_args()

    print("\n============================================================")
    print("INTEGRATE CLADE DIVERGENCE SIGNALS v2.0")
    print("============================================================")

    main(args)

    print("\n============================================================")
    print("PIPELINE FINISHED")
    print("============================================================")