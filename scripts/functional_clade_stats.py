#!/usr/bin/env python3

import subprocess
import os
import glob

print("\n=== Functional Comparison Between Clades ===\n")

vcf_dir = input("Diretório contendo VCFs dos clados: ").strip()

if not os.path.exists(vcf_dir):
    print("Diretório não encontrado.")
    exit()

vcfs = glob.glob(os.path.join(vcf_dir, "*.ann.vcf.gz"))

if not vcfs:
    print("Nenhum VCF encontrado.")
    exit()

print("\nAnalisando clados...\n")

results = []

for vcf in vcfs:
    clade = os.path.basename(vcf).replace(".ann.vcf.gz", "")
    print(f"Processando: {clade}")

    total = int(subprocess.check_output(
        f"bcftools view -H {vcf} | wc -l",
        shell=True).decode().strip())

    high = int(subprocess.check_output(
        f"bcftools view -H {vcf} | grep 'HIGH' | wc -l",
        shell=True).decode().strip())

    moderate = int(subprocess.check_output(
        f"bcftools view -H {vcf} | grep 'MODERATE' | wc -l",
        shell=True).decode().strip())

    low = int(subprocess.check_output(
        f"bcftools view -H {vcf} | grep 'LOW' | wc -l",
        shell=True).decode().strip())

    missense = int(subprocess.check_output(
        f"bcftools view -H {vcf} | grep 'missense_variant' | wc -l",
        shell=True).decode().strip())

    synonymous = int(subprocess.check_output(
        f"bcftools view -H {vcf} | grep 'synonymous_variant' | wc -l",
        shell=True).decode().strip())

    ratio = round(missense / synonymous, 3) if synonymous > 0 else "NA"

    results.append([
        clade, total, high, moderate, low,
        missense, synonymous, ratio
    ])

print("\nResumo:\n")
print("Clade\tTotal\tHIGH\tMODERATE\tLOW\tMissense\tSynonymous\tMiss/Syn")

for r in results:
    print("\t".join(map(str, r)))