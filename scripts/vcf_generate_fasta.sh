#!/bin/bash

set -euo pipefail

VCF="$1"
REF="$2"
SAMPLES="$3"
OUTDIR="$4"

mkdir -p "${OUTDIR}"

for sample in $(cat "${SAMPLES}"); do
  bcftools consensus \
    -s "$sample" \
    -f "$REF" \
    "$VCF" \
    > "${OUTDIR}/${sample}.fasta"
done

