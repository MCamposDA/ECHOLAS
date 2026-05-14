#!/bin/bash

set -euo pipefail

# ===============================
# PCA pipeline – PLINK + R
# ===============================

# ---- Argumentos ----
VCF="$1"          # Ex: joint_vcf/strain_snps_Fpca.vcf.gz
PREFIX="$2"       # Ex: strain_PCA
OUTDIR="${3:-pca/output}"  # Default se não for passado
PLOT_SCRIPT="$4"

# ---- Validação básica ----
if [[ $# -lt 4 ]]; then
    echo "Uso:"
    echo " bash run_pca.sh <input.vcf.gz> <prefix> <output_dir> <plot_script.R>"
    exit 1
fi

mkdir -p "${OUTDIR}"

echo ">> Input VCF : ${VCF}"
echo ">> Prefix    : ${PREFIX}"
echo ">> OutputDir : ${OUTDIR}"

# ===============================
# 1. VCF → PLINK
# ===============================

plink \
  --vcf "${VCF}" \
  --double-id \
  --allow-extra-chr \
  --make-bed \
  --out "${OUTDIR}/${PREFIX}"

# ===============================
# 2. PCA
# ===============================

plink \
  --bfile "${OUTDIR}/${PREFIX}" \
  --allow-extra-chr \
  --pca 10 \
  --out "${OUTDIR}/${PREFIX}"

# ===============================
# 3. Plot em R
# ===============================

Rscript "$PLOT_SCRIPT" \
    "${OUTDIR}/${PREFIX}.eigenvec" \
    "${OUTDIR}/${PREFIX}.eigenval" \
    "${OUTDIR}/${PREFIX}_PC1_PC2.pdf"

echo "✔ PCA finalizado com sucesso"

