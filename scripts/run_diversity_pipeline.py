#!/usr/bin/env python3

import argparse
import subprocess
import os
import glob

GENOME_SIZE = 32000000
WINDOW_SIZE = 10000


def run_cmd(cmd):
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)


def run_diversity(vcf, out_prefix, keep_file=None):
    base_cmd = ["vcftools", "--gzvcf", vcf]

    if keep_file is not None:
        base_cmd += ["--keep", keep_file]

    # π global (site-based)
    run_cmd(base_cmd + [
        "--site-pi",
        "--out", f"{out_prefix}_pi"
    ])

    # π 10kb
    run_cmd(base_cmd + [
        "--window-pi", str(WINDOW_SIZE),
        "--out", f"{out_prefix}_pi_10kb"
    ])

    # Tajima global
    run_cmd(base_cmd + [
        "--TajimaD", str(GENOME_SIZE),
        "--out", f"{out_prefix}_tajima"
    ])

    # Tajima 10kb
    run_cmd(base_cmd + [
        "--TajimaD", str(WINDOW_SIZE),
        "--out", f"{out_prefix}_tajima_10kb"
    ])


def main():
    parser = argparse.ArgumentParser(
        description="Run diversity analyses (pi and Tajima) globally and per clade"
    )

    parser.add_argument(
        "-v", "--vcf",
        required=True,
        help="Input VCF (.vcf.gz)"
    )

    parser.add_argument(
        "-c", "--clade_dir",
        required=True,
        help="Directory containing clade .txt files"
    )

    parser.add_argument(
        "-o", "--outdir",
        default="diversity_results",
        help="Output directory"
    )

    args = parser.parse_args()

    vcf = args.vcf
    clade_dir = args.clade_dir
    outdir = args.outdir

    os.makedirs(outdir, exist_ok=True)

    # STRAINS (todas juntas)
    strains_dir = os.path.join(outdir, "STRAINS")
    os.makedirs(strains_dir, exist_ok=True)

    run_diversity(
        vcf,
        os.path.join(strains_dir, "STRAINS")
    )

    # Clades individuais
    clade_files = glob.glob(os.path.join(clade_dir, "*.txt"))

    for clade_file in clade_files:
        clade_name = os.path.splitext(os.path.basename(clade_file))[0]
        clade_outdir = os.path.join(outdir, clade_name)
        os.makedirs(clade_outdir, exist_ok=True)

        run_diversity(
            vcf,
            os.path.join(clade_outdir, clade_name),
            keep_file=clade_file
        )


if __name__ == "__main__":
    main()