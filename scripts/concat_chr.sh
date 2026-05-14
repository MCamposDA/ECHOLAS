#!/bin/bash

set -euo pipefail

IN_DIR="$1"
OUT_DIR="$2"

mkdir -p "$OUT_DIR"

for f in ${IN_DIR}/*.fasta; do
    sample=$(basename $f .fasta)

    echo ">$sample" > ${OUT_DIR}/${sample}.fasta
    grep -v "^>" $f | tr -d '\n' >> ${OUT_DIR}/${sample}.fasta
    echo >> ${OUT_DIR}/${sample}.fasta
done

