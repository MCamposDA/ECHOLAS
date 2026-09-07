nextflow.enable.dsl=2

////////////////////////////////////////////////////
//// IMPORT DO INDEX_REF (REUTILIZA DO MÓDULO 2)
////////////////////////////////////////////////////

include { INDEX_REF } from './alignment_variant.nf'

////////////////////////////////////////////////////
//// GVCF MAP (sample-name-map)
////////////////////////////////////////////////////

process MAKE_GVCF_MAP {

    conda "conda-forge::coreutils"

    publishDir "results/genotyping", mode: 'copy'

    input:
    path gvcfs

    output:
    path "gvcf.list"

    script:
    """
    rm -f gvcf.list

    for f in ${gvcfs}; do
        if [[ "\$f" == *.g.vcf.gz ]]; then
            sample=\$(basename "\$f" .g.vcf.gz)
            real=\$(realpath "\$f")
            echo -e "\${sample}\t\${real}" >> gvcf.list
        fi
    done
    """
}

////////////////////////////////////////////////////
//// INTERVAL LIST
////////////////////////////////////////////////////

process MAKE_INTERVALS {

    conda "conda-forge::coreutils"

    publishDir "results/genotyping", mode: 'copy'

    input:
    tuple path(ref), path(index_files)

    output:
    path "intervals.list"

    script:
    """
    cut -f1 ${ref}.fai > intervals.list
    """
}

////////////////////////////////////////////////////
//// GENOMICS DB IMPORT
////////////////////////////////////////////////////

process GENOMICS_DB_IMPORT {

    tag "GenomicsDB"

    conda "bioconda::gatk4=4.6.2.0"

    publishDir "results/genotyping/genomicsdb", mode: 'copy'

    cpus 6

    input:
    path gvcf_list
    path intervals
    tuple path(ref), path(index_files)

    output:
    path "genomicsdb"

    script:
    """
    mkdir -p genomicsdb

    gatk GenomicsDBImport \
      --genomicsdb-workspace-path genomicsdb/Leishmania_braz_db \
      --sample-name-map $gvcf_list \
      -R $ref \
      -L $intervals \
      --reader-threads ${task.cpus}
    """
}

////////////////////////////////////////////////////
//// GENOTYPE GVCFS
////////////////////////////////////////////////////

process GENOTYPE_GVCFS {

    tag "JointGenotyping"

    conda "bioconda::gatk4=4.6.2.0"

    publishDir "results/genotyping/joint_vcf", mode: 'copy'

    cpus 6

    input:
    path genomicsdb
    tuple path(ref), path(index_files)

    output:
    path "joint_vcf/strain_raw.vcf.gz"

    script:
    """
    mkdir -p joint_vcf

    gatk GenotypeGVCFs \
      -R $ref \
      -V gendb://genomicsdb/Leishmania_braz_db \
      -O joint_vcf/strain_raw.vcf.gz
    """
}

////////////////////////////////////////////////////
//// CHECK VCF
////////////////////////////////////////////////////

process CHECK_VCF {

    conda "bioconda::bcftools=1.19"

    publishDir "results/genotyping/qc", mode: 'copy'

    input:
    path vcf

    output:
    path "vcf_header.txt"

    script:
    """
    bcftools view -h $vcf | tail > vcf_header.txt
    """
}

////////////////////////////////////////////////////
//// WORKFLOW
////////////////////////////////////////////////////

workflow GENOTYPING {

    take:
    gvcfs
    ref

    main:

    ////////////////////////////////////////////////////
    // REFERÊNCIA (AGORA CORRETA)
    ////////////////////////////////////////////////////

    indexed_ref = INDEX_REF(ref)

    ////////////////////////////////////////////////////
    // GVCF MAP
    ////////////////////////////////////////////////////

    gvcf_files = gvcfs.map { sample, gvcf, tbi -> tuple(gvcf, tbi) }
    gvcf_map = MAKE_GVCF_MAP(gvcf_files.collect())

    ////////////////////////////////////////////////////
    // INTERVALS
    ////////////////////////////////////////////////////

    intervals = MAKE_INTERVALS(indexed_ref)

    ////////////////////////////////////////////////////
    // GENOMICS DB
    ////////////////////////////////////////////////////

    db = GENOMICS_DB_IMPORT(gvcf_map, intervals, indexed_ref)

    ////////////////////////////////////////////////////
    // JOINT GENOTYPING
    ////////////////////////////////////////////////////

    joint_vcf = GENOTYPE_GVCFS(db, indexed_ref)

    ////////////////////////////////////////////////////
    // CHECK
    ////////////////////////////////////////////////////

    CHECK_VCF(joint_vcf)

    emit:
    joint_vcf
}
