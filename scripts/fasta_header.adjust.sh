#!/bin/bash

set -euo pipefail

DIR="$1"

for f in ${DIR}/*.fasta; do
    sample=$(basename $f .fasta)
    sed -i "1s/.*/>$sample/" $f
done

