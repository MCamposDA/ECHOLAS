#!/usr/bin/env python3

import argparse
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import operator
import os

# ==========================
# Utility: Operator mapping
# ==========================

OPS = {
    ">=": operator.ge,
    "<=": operator.le,
    "!=": operator.ne,
    "==": operator.eq,
    ">": operator.gt,
    "<": operator.lt
}

# ==========================
# CORE 1 — FILTER
# ==========================

def run_filter(args):
    df = pd.read_csv(args.input)

    if len(args.filter) % 2 != 0:
        raise ValueError("Filters must be provided in pairs: field condition")

    for i in range(0, len(args.filter), 2):
        field = args.filter[i]
        condition = args.filter[i+1]

        matched = False

        for op_symbol in OPS:
            if condition.startswith(op_symbol):
                value_str = condition[len(op_symbol):]

                try:
                    value = float(value_str)
                except ValueError:
                    raise ValueError(
                        f"Invalid numeric value in condition '{condition}'"
                    )

                op_func = OPS[op_symbol]
                matched = True
                break

        if not matched:
            raise ValueError(f"Invalid condition format: {condition}")

        if field not in df.columns:
            raise ValueError(f"Field '{field}' not found in CSV.")

        df = df[op_func(df[field], value)]

    output = args.output if args.output else "filtered_output.csv"
    df.to_csv(output, index=False)

    print(f"[INFO] Filtered file saved as: {output}")
    print(f"[INFO] Remaining genes: {len(df)}")


# ==========================
# CORE 2 — FUNCTION ANNOTATION
# ==========================

def parse_gff(gff_file):
    """
    Robust parser for NCBI RefSeq GFF3 (Leishmania braziliensis ASM284v2).

    Extracts for each gene:
    - feature_type (always "gene")
    - gene_biotype (protein_coding, tRNA, rRNA, etc.)
    - product (from mRNA or CDS)
    """

    import urllib.parse

    genes = {}
    mrna_to_gene = {}

    with open(gff_file) as gff:
        for line in gff:
            if line.startswith("#"):
                continue

            parts = line.strip().split("\t")
            if len(parts) < 9:
                continue

            feature_type = parts[2]
            attributes = parts[8]

            attr_dict = {}
            for field in attributes.split(";"):
                if "=" in field:
                    key, value = field.split("=", 1)
                    attr_dict[key] = value

            # =========================
            # GENE LEVEL
            # =========================
            if feature_type == "gene":

                gene_id = attr_dict.get("ID")
                biotype = attr_dict.get("gene_biotype", "unknown")

                if gene_id:
                    genes[gene_id] = {
                        "feature_type": "gene",
                        "biotype": biotype,
                        "product": None
                    }

            # =========================
            # mRNA LEVEL
            # =========================
            elif feature_type == "mRNA":

                mrna_id = attr_dict.get("ID")
                parent_gene = attr_dict.get("Parent")
                product = attr_dict.get("product")

                if mrna_id and parent_gene:
                    mrna_to_gene[mrna_id] = parent_gene

                    if parent_gene in genes and product:
                        genes[parent_gene]["product"] = urllib.parse.unquote(product)

            # =========================
            # CDS LEVEL
            # =========================
            elif feature_type == "CDS":

                parent_mrna = attr_dict.get("Parent")
                product = attr_dict.get("product")

                if parent_mrna:
                    gene_parent = mrna_to_gene.get(parent_mrna)

                    if gene_parent and gene_parent in genes and product:
                        genes[gene_parent]["product"] = urllib.parse.unquote(product)

    # =========================
    # FINAL CLEANUP
    # =========================
    for gene_id in genes:
        if not genes[gene_id]["product"]:
            genes[gene_id]["product"] = "hypothetical protein"

    return genes


def run_function(args):

    import pandas as pd

    df = pd.read_csv(args.input)
    annotations = parse_gff(args.gff)

    # ---------------------------------------------------------
    # Ajuste automático se CSV não tiver prefixo "gene-"
    # ---------------------------------------------------------
    if not df["gene_id"].iloc[0].startswith("gene-"):
        df["gene_id"] = df["gene_id"].apply(lambda x: f"gene-{x}")

    # ---------------------------------------------------------
    # Map annotations
    # ---------------------------------------------------------
    df["feature_type"] = df["gene_id"].map(
        lambda x: annotations.get(x, {}).get("feature_type", "NA")
    )

    df["biotype"] = df["gene_id"].map(
        lambda x: annotations.get(x, {}).get("biotype", "NA")
    )

    df["product"] = df["gene_id"].map(
        lambda x: annotations.get(x, {}).get("product", "NA")
    )

    # ---------------------------------------------------------
    # Output
    # ---------------------------------------------------------
    output = args.output if args.output else "annotated_output.csv"
    df.to_csv(output, index=False)

    print("\n[INFO] Gene annotation added successfully.")
    print(f"[INFO] File saved as: {output}")

# ==========================
# CORE 3 — VISUALIZE
# ==========================

def run_visualize(args):

    import pandas as pd
    import numpy as np
    import matplotlib.pyplot as plt
    import seaborn as sns
    import random

    df = pd.read_csv(args.input)

    # =========================================================
    # FIGURE 1 — HEATMAP (gene × clade)
    # =========================================================

    pivot = df.pivot_table(
        index="gene_id",
        columns="clade",
        values="evidence_score",
        fill_value=0
    )

    plt.figure(figsize=(10, max(6, len(pivot) * 0.25)))

    ax = sns.heatmap(
        pivot,
        cmap="Reds",
        linewidths=0.5,
        linecolor="lightgray",
        cbar_kws={
            "label": "Evidence Score\n0 = none | 1 = single signal | ≥2 = multiple signals"
        }
    )

    plt.title(
        "Gene-level Divergence Across Clades\n"
        "(Higher scores indicate stronger evidence of clade-associated divergence)",
        fontsize=14
    )

    plt.xlabel("Clade")
    plt.ylabel("Gene")

    plt.tight_layout()

    heatmap_file = args.prefix + "_heatmap.png"
    plt.savefig(heatmap_file, dpi=300)
    plt.close()

    # =========================================================
    # FIGURE 2 — GENE-LEVEL MANHATTAN
    # =========================================================

    plt.figure(figsize=(12, 6))

    clades = df["clade"].unique()

    # Generate unlimited distinct colors
    colors = {}
    for clade in clades:
        colors[clade] = (
            random.random(),
            random.random(),
            random.random()
        )

    for clade in clades:
        subset = df[df["clade"] == clade]

        x = (subset["start"] + subset["end"]) / 2

        plt.scatter(
            x,
            subset["evidence_score"],
            label=clade,
            color=colors[clade],
            alpha=0.8,
            edgecolor="black",
            linewidth=0.3,
            s=35
        )

    plt.title(
        "Clade-associated Gene Divergence Across Genome",
        fontsize=14
    )

    plt.xlabel("Genomic Position (bp)")
    plt.ylabel("Evidence Score")

    plt.legend(
        title="Clade",
        bbox_to_anchor=(1.02, 1),
        loc="upper left"
    )

    plt.tight_layout()

    manhattan_file = args.prefix + "_manhattan.png"
    plt.savefig(manhattan_file, dpi=300)
    plt.close()

    # =========================================================
    # FIGURE 3 — SNP DENSITY DISTRIBUTION
    # =========================================================

    density = df["snp_density"].dropna()

    mean_val = density.mean()
    median_val = density.median()
    p95 = density.quantile(0.95)

    plt.figure(figsize=(8, 6))

    plt.hist(
        density,
        bins=30,
        edgecolor="black"
    )

    # Mean (média)
    plt.axvline(
    mean_val,
    linestyle="--",
    linewidth=1.2,
    color="red",
    label=f"Mean = {mean_val:.3f}"
)

# Median (mediana)
    plt.axvline(
    median_val,
    linestyle="-.",
    linewidth=1.2,
    color="green",
    label=f"Median = {median_val:.3f}"
)

# 95th percentile (extreme values)
    plt.axvline(
    p95,
    linestyle=":",
    linewidth=1.2,
    color="purple",
    label=f"95th percentile = {p95:.3f}"
)

    plt.title(
        "Distribution of SNP Density Across Candidate Genes",
        fontsize=14
    )

    plt.xlabel("SNP Density (SNPs per bp)")
    plt.ylabel("Number of Genes")

    plt.legend()

    plt.tight_layout()

    density_file = args.prefix + "_snp_density.png"
    plt.savefig(density_file, dpi=300)
    plt.close()

    # =========================================================
    # SUMMARY
    # =========================================================

    print("\n[INFO] Visualization completed successfully.")
    print(f"[INFO] Heatmap: {heatmap_file}")
    print(f"[INFO] Manhattan plot: {manhattan_file}")
    print(f"[INFO] SNP density distribution: {density_file}")


# ==========================
# ARGPARSE
# ==========================

def main():
    parser = argparse.ArgumentParser(
        description="Clade Divergence Toolkit"
    )

    subparsers = parser.add_subparsers(dest="command")

    # FILTER
    parser_filter = subparsers.add_parser("filter")
    parser_filter.add_argument("--input", required=True)
    parser_filter.add_argument("--filter", nargs="+", required=True)
    parser_filter.add_argument("--output")

    # FUNCTION
    parser_function = subparsers.add_parser("function")
    parser_function.add_argument("--input", required=True)
    parser_function.add_argument("--gff", required=True)
    parser_function.add_argument("--output")

    # VISUALIZE
    parser_visualize = subparsers.add_parser("visualize")
    parser_visualize.add_argument("--input", required=True)
    parser_visualize.add_argument(
    "--prefix",
    default="divergence_plots",
    help="Output filename prefix"
)
    args = parser.parse_args()

    if args.command == "filter":
        run_filter(args)
    elif args.command == "function":
        run_function(args)
    elif args.command == "visualize":
        run_visualize(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

