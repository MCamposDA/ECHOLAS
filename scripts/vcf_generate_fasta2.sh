#!/usr/bin/env bash

set -euo pipefail

VCF="$1"
REF="$2"          # Mantido apenas para compatibilidade com o pipeline
SAMPLES="$3"
OUTDIR="$4"

mkdir -p "$OUTDIR"

##############################
# Validação das entradas
##############################

[[ -f "$VCF" ]] || { echo "Erro: VCF não encontrado."; exit 1; }
[[ -f "$SAMPLES" ]] || { echo "Erro: samples.list não encontrado."; exit 1; }

##############################
# Verifica se há SNPs
##############################

if [[ $(bcftools view -H "$VCF" | wc -l) -eq 0 ]]; then
    echo "Nenhum SNP encontrado no VCF."
    exit 1
fi

##############################
# Extrai matriz de genótipos
##############################

TMP=$(mktemp)

bcftools query \
    -f '%CHROM\t%POS\t%REF\t%ALT[\t%GT]\n' \
    "$VCF" > "$TMP"

##############################
# Lê nomes das amostras
##############################

mapfile -t SAMPLE_NAMES < "$SAMPLES"

##############################
# Inicializa FASTAs
##############################

for sample in "${SAMPLE_NAMES[@]}"; do
    echo ">$sample" > "${OUTDIR}/${sample}.fasta"
done

##############################
# Constrói sequências SNP
##############################

awk -v outdir="$OUTDIR" '
BEGIN{
    OFS="\t"
}

{

    ref=$3

    split($4,alts,",")

    for(i=5;i<=NF;i++){

        gt=$i

        allele="N"

        if(gt=="0/0" || gt=="0|0" || gt=="0"){

            allele=ref

        }

        else if(gt=="1/1" || gt=="1|1" || gt=="1"){

            allele=alts[1]

        }

        else if(gt=="2/2" || gt=="2|2"){

            allele=alts[2]

        }

        else if(gt=="3/3" || gt=="3|3"){

            allele=alts[3]

        }

        else if(gt=="0/1" || gt=="1/0" ||
                gt=="0|1" || gt=="1|0"){

            allele=alts[1]

        }

        else if(gt=="./." || gt==".|." || gt=="."){

            allele="N"

        }

        sample=i-4

        printf "%s", allele >> outdir"/seq_"sample

    }

}
' "$TMP"

##############################
# Junta cabeçalho + sequência
##############################

for i in "${!SAMPLE_NAMES[@]}"; do

    seqfile="${OUTDIR}/seq_$((i+1))"

    tr -d '\n' < "$seqfile" >> "${OUTDIR}/${SAMPLE_NAMES[$i]}.fasta"

    echo >> "${OUTDIR}/${SAMPLE_NAMES[$i]}.fasta"

    rm "$seqfile"

done

rm "$TMP"
