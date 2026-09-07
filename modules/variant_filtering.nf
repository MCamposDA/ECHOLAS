include { INDEX_REF } from './alignment_variant.nf'

process SNP_EXTRACTION {

    conda "bioconda::bcftools=1.19"

    publishDir "results/filtering/snps", mode: 'copy'

    input:
    path vcf

    output:
    path "strain_snps_raw.vcf.gz", emit: vcf
    path "strain_snps_raw.vcf.gz.tbi", emit: index

    script:
    """
    bcftools view \
      --types snps \
      --min-alleles 2 \
      --max-alleles 2 \
      -Oz \
      -o strain_snps_raw.vcf.gz \
      $vcf

    bcftools index -t strain_snps_raw.vcf.gz
    """
}

process SNP_FILTER_STRICT {

    conda "bioconda::bcftools=1.19"

    publishDir "results/filtering/snps", mode: 'copy'

    input:
    path vcf

    output:
    path "strain_snps_filtered.vcf.gz", emit: vcf
    path "strain_snps_filtered.vcf.gz.tbi", emit: index

    script:
    """
    bcftools filter \
      -e 'QUAL<30 || FORMAT/DP<10' \
      -Oz \
      -o strain_snps_filtered.vcf.gz \
      $vcf

    bcftools index -t strain_snps_filtered.vcf.gz
    """
}

process SNP_FILTER_PCA {

    conda "bioconda::bcftools=1.19"

    publishDir "results/filtering/pca", mode: 'copy'

    input:
    path vcf

    output:
    path "strain_snps_Fpca.vcf.gz", emit: vcf
    path "strain_snps_Fpca.vcf.gz.tbi", emit: index

    script:
    """
    bcftools view \
      -e 'F_MISSING > 0.1' \
      -Oz \
      -o strain_snps_Fpca.vcf.gz \
      $vcf

    bcftools index -t strain_snps_Fpca.vcf.gz
    """
}

process SNP_FILTER_PHYLO {

    conda "bioconda::bcftools=1.19"

    publishDir "results/filtering/phylo", mode: 'copy'

    input:
    path vcf

    output:
    path "strain_snps_Fphylo.vcf.gz", emit: vcf
    path "strain_snps_Fphylo.vcf.gz.tbi", emit: index

    script:
    """
    bcftools view \
      -i 'GT="1"' \
      -Oz \
      -o strain_snps_Fphylo.vcf.gz \
      $vcf

    bcftools index -t strain_snps_Fphylo.vcf.gz
    """
}

process SELECT_VARIANTS {

    conda "bioconda::gatk4=4.6.2.0"
    publishDir "results/filtering/gatk", mode: 'copy'

    input:
    path vcf
    tuple path(ref), path(index_files)

    output:
    tuple path("strain_raw_snps.vcf.gz"), path("strain_raw_snps.vcf.gz.tbi"), emit: snps
    tuple path("strain_raw_indels.vcf.gz"), path("strain_raw_indels.vcf.gz.tbi"), emit: indels

    script:
    """
    if [ ! -f ${vcf}.tbi ]; then
        gatk IndexFeatureFile -I $vcf
    fi

    gatk SelectVariants \
      -R $ref \
      -V $vcf \
      --select-type-to-include SNP \
      -O strain_raw_snps.vcf.gz

    gatk SelectVariants \
      -R $ref \
      -V $vcf \
      --select-type-to-include INDEL \
      -O strain_raw_indels.vcf.gz

    gatk IndexFeatureFile -I strain_raw_snps.vcf.gz
    gatk IndexFeatureFile -I strain_raw_indels.vcf.gz
    """
}

process FILTER_SNPS_GATK {

    conda "bioconda::gatk4=4.6.2.0"

    publishDir "results/filtering/gatk", mode: 'copy'

    input:
    tuple path(vcf), path(tbi)
    tuple path(ref), path(index_files)

    output:
    path "strain_filtered_snps.vcf.gz", emit: vcf

    script:
    """
    gatk VariantFiltration \
      -R $ref \
      -V $vcf \
      -O strain_filtered_snps.vcf.gz \
      --filter-name "QD_lt_2" --filter-expression "QD < 2.0" \
      --filter-name "FS_gt_60" --filter-expression "FS > 60.0" \
      --filter-name "MQ_lt_40" --filter-expression "MQ < 40.0" \
      --filter-name "SOR_gt_3" --filter-expression "SOR > 3.0"
    """
}

process FILTER_INDELS_GATK {

    conda "bioconda::gatk4=4.6.2.0"

    publishDir "results/filtering/gatk", mode: 'copy'

    input:
    tuple path(vcf), path(tbi)
    tuple path(ref), path(index_files)

    output:
    path "strain_filtered_indels.vcf.gz", emit: vcf

    script:
    """
    gatk VariantFiltration \
      -R $ref \
      -V $vcf \
      -O strain_filtered_indels.vcf.gz \
      --filter-name "QD_lt_2" --filter-expression "QD < 2.0" \
      --filter-name "FS_gt_200" --filter-expression "FS > 200.0" \
      --filter-name "SOR_gt_10" --filter-expression "SOR > 10.0"
    """
}

process FINAL_MERGE {

    conda "bioconda::bcftools=1.19"

    publishDir "results/filtering/final", mode: 'copy'

    input:
    path snps
    path indels

    output:
    path "strain_PASS.vcf.gz", emit: vcf
    path "strain_PASS.vcf.gz.tbi", emit: index

    script:
    """
    bcftools view -f PASS $snps -Oz -o snps_pass.vcf.gz
    bcftools view -f PASS $indels -Oz -o indels_pass.vcf.gz

    bcftools index -t snps_pass.vcf.gz
    bcftools index -t indels_pass.vcf.gz

    bcftools concat -a snps_pass.vcf.gz indels_pass.vcf.gz -Oz -o merged.vcf.gz

    bcftools sort merged.vcf.gz -Oz -o strain_PASS.vcf.gz

    bcftools index -t strain_PASS.vcf.gz
    """
}

workflow VARIANT_FILTERING {

    take:
    joint_vcf
    ref

    main:

    indexed_ref = INDEX_REF(ref)

    snps_raw = SNP_EXTRACTION(joint_vcf)
    snps_filtered = SNP_FILTER_STRICT(snps_raw.vcf)

    SNP_FILTER_PCA(snps_filtered.vcf)
    SNP_FILTER_PHYLO(snps_filtered.vcf)

    selected = SELECT_VARIANTS(joint_vcf, indexed_ref)

    filtered_snps = FILTER_SNPS_GATK(
        selected.snps,
        indexed_ref
    )

    filtered_indels = FILTER_INDELS_GATK(
        selected.indels,
        indexed_ref
    )

    final_vcf = FINAL_MERGE(filtered_snps.vcf, filtered_indels.vcf)

    emit:
    vcf = final_vcf.vcf
    vcf_pca = SNP_FILTER_PCA.out.vcf
    vcf_phylo = SNP_FILTER_PHYLO.out.vcf.combine(SNP_FILTER_PHYLO.out.index)
}
