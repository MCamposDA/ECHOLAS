#!/usr/bin/env python3

import os
import argparse
import itertools
import subprocess
import sys


def run_cmd(cmd):
    """Run shell command and stop if error occurs."""
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)


def prepare_vcf(input_vcf, output_prefix):
    """
    Filter VCF for FST analysis:
    - max 10% missing
    - MAF >= 0.05
    - biallelic only
    """

    print("\n=== Preparing VCF for FST ===\n")

    cmd = [
        "vcftools",
        "--gzvcf", input_vcf,
        "--max-missing", "0.9",
        "--maf", "0.05",
        "--min-alleles", "2",
        "--max-alleles", "2",
        "--recode",
        "--recode-INFO-all",
        "--out", output_prefix
    ]

    run_cmd(cmd)

    # Compress
    run_cmd(["bgzip", "-f", output_prefix + ".recode.vcf"])
    run_cmd(["tabix", "-f", "-p", "vcf", output_prefix + ".recode.vcf.gz"])

    return output_prefix + ".recode.vcf.gz"


def get_clade_files(clade_dir):
    """Get all .txt clade files."""
    files = [f for f in os.listdir(clade_dir) if f.endswith(".txt")]
    if len(files) < 2:
        print("ERROR: Need at least two clade .txt files.")
        sys.exit(1)
    return files


def calculate_pairwise_fst(vcf, clade_dir, outdir):
    """Calculate FST for all pairwise clade combinations."""

    clade_files = get_clade_files(clade_dir)
    pairs = list(itertools.combinations(clade_files, 2))

    summary_file = os.path.join(outdir, "fst_summary.txt")
    with open(summary_file, "w") as summary:
        summary.write("Clade1\tClade2\tMean_FST\n")

        for c1, c2 in pairs:
            name1 = c1.replace(".txt", "")
            name2 = c2.replace(".txt", "")
            prefix = os.path.join(outdir, f"{name1}_vs_{name2}")

            print(f"\n=== Running FST: {name1} vs {name2} ===\n")

            cmd = [
                "vcftools",
                "--gzvcf", vcf,
                "--weir-fst-pop", os.path.join(clade_dir, c1),
                "--weir-fst-pop", os.path.join(clade_dir, c2),
                "--fst-window-size", "10000",
                "--fst-window-step", "5000",
                "--out", prefix
            ]

            run_cmd(cmd)

            window_file = prefix + ".windowed.weir.fst"

            # Calculate mean FST
            if os.path.exists(window_file):
                with open(window_file) as f:
                    next(f)  # skip header
                    values = [float(line.split()[4]) for line in f if line.strip()]
                    mean_fst = sum(values) / len(values) if values else 0
            else:
                mean_fst = 0

            summary.write(f"{name1}\t{name2}\t{mean_fst:.6f}\n")

    print("\n=== Pairwise FST completed ===\n")


def main():
    parser = argparse.ArgumentParser(
        description="Run FST pipeline for clades."
    )
    parser.add_argument(
        "-v", "--vcf",
        required=True,
        help="PASS SNP VCF (.vcf.gz)"
    )
    parser.add_argument(
        "-c", "--clades",
        default="clade_vcfs",
        help="Directory containing clade .txt files"
    )

    args = parser.parse_args()

    if not os.path.exists(args.vcf):
        print("ERROR: VCF file not found.")
        sys.exit(1)

    if not os.path.isdir(args.clades):
        print("ERROR: Clade directory not found.")
        sys.exit(1)

    os.makedirs("FST", exist_ok=True)

    filtered_vcf = prepare_vcf(args.vcf, "FST/filtered_forFST")

    calculate_pairwise_fst(filtered_vcf, args.clades, "FST")

    print("\n=== FST PIPELINE FINISHED SUCCESSFULLY ===\n")


if __name__ == "__main__":
    main()