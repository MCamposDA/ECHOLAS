nextflow.enable.dsl=2

process INDEX_REF {

    conda "bioconda::bwa=0.7.17 bioconda::samtools=1.19 bioconda::gatk4=4.6.2.0"

    input:
    path ref

    output:
    tuple path(ref), path("*")

    script:
    """
    bwa index $ref
    samtools faidx $ref
    gatk CreateSequenceDictionary -R $ref -O ${ref.baseName}.dict
    """
}

////////////////////////////////////////////////////
//// ALIGN + SORT
////////////////////////////////////////////////////

process ALIGN_SORT {

    tag "$sample"

    conda "bioconda::bwa=0.7.17 bioconda::samtools=1.19"

    publishDir "results/alignments", mode: 'copy'

    cpus 4
    memory '4 GB'

    input:
    tuple val(sample), path(reads)
    tuple path(ref), path(index_files)

    output:
    tuple val(sample), path("bam/${sample}_sorted.bam")

    script:

    def cmd = ""

    if (reads instanceof List && reads.size() == 2) {
        cmd = "bwa mem -t ${task.cpus} -R \"@RG\\tID:${sample}\\tSM:${sample}\\tPL:ILLUMINA\" $ref ${reads[0]} ${reads[1]}"
    } else {
        cmd = "bwa mem -t ${task.cpus} -R \"@RG\\tID:${sample}\\tSM:${sample}\\tPL:ILLUMINA\" $ref ${reads}"
    }

    """
    mkdir -p bam

    ${cmd} | samtools sort -m 1G -@ ${task.cpus} -o bam/${sample}_sorted.bam
    """
}

////////////////////////////////////////////////////
//// INDEX BAM
////////////////////////////////////////////////////

process INDEX_BAM {

    tag "$sample"

    conda "bioconda::samtools=1.19"

    publishDir "results/alignments", mode: 'copy', pattern: "*.bai"

    input:
    tuple val(sample), path(bam)

    output:
    tuple val(sample), path(bam), path("${bam}.bai")

    script:
    """
    samtools index $bam
    """
}

////////////////////////////////////////////////////
//// BAM STATS
////////////////////////////////////////////////////

process BAM_STATS {

    tag "$sample"

    conda "bioconda::samtools=1.19"

    publishDir "results/alignments/statistics", mode: 'copy'

    input:
    tuple val(sample), path(bam), path(bai)

    output:
    path "stats/${sample}_flagstat.txt"
    path "stats/${sample}_coverage.txt"

    script:
    """
    mkdir -p stats

    samtools flagstat $bam > stats/${sample}_flagstat.txt
    samtools coverage $bam > stats/${sample}_coverage.txt
    """
}

////////////////////////////////////////////////////
//// MARK DUPLICATES
////////////////////////////////////////////////////

process MARK_DUPLICATES {

    tag "$sample"

    conda "bioconda::picard=3.1.1"

    publishDir "results/alignments", mode: 'copy'

    cpus 8

    input:
    tuple val(sample), path(bam), path(bai)

    output:
    tuple val(sample), path("bam_dedup/${sample}_dedup.bam")

    script:
    """
    mkdir -p bam_dedup

    picard MarkDuplicates \
      I=$bam \
      O=bam_dedup/${sample}_dedup.bam \
      M=bam_dedup/${sample}.dup_metrics.txt \
      CREATE_INDEX=true \
      VALIDATION_STRINGENCY=SILENT
    """
}

////////////////////////////////////////////////////
//// HAPLOTYPE CALLER
////////////////////////////////////////////////////

process HAPLOTYPE_CALLER {

    tag "$sample"

    conda "bioconda::gatk4=4.6.2.0"

    publishDir "results/mapping", mode: 'copy'

    cpus 8

    input:
    tuple val(sample), path(bam)
    tuple path(ref), path(index_files)

    output:
    tuple val(sample), path("gvcf/${sample}.g.vcf.gz")

    script:
    """
    mkdir -p gvcf

    gatk HaplotypeCaller \
      -R $ref \
      -I $bam \
      -O gvcf/${sample}.g.vcf.gz \
      -ERC GVCF \
      --ploidy 2 \
      --native-pair-hmm-threads ${task.cpus}
    """
}

process INDEX_GVCF {

    tag "$sample"

    conda "bioconda::gatk4=4.6.2.0"

    publishDir "results/gvcf", mode: 'copy'

    input:
    tuple val(sample), path(gvcf)

    output:
    tuple val(sample), path(gvcf), path("${gvcf}.tbi")

    script:
    """
    gatk IndexFeatureFile -I $gvcf
    """
}

////////////////////////////////////////////////////
//// WORKFLOW
////////////////////////////////////////////////////

workflow ALIGNMENT_VARIANT {

    take:
    trimmed_reads
    indexed_ref

    main:

    ////////////////////////////////////////////////////
    // NORMALIZAÇÃO DA ENTRADA
    ////////////////////////////////////////////////////

    normalized = trimmed_reads.map { sample, reads ->

        if (reads instanceof List) {
            return tuple(sample, reads)
        } else {
            return tuple(sample, [reads])
        }
    }

    ////////////////////////////////////////////////////
    // ALIGN
    ////////////////////////////////////////////////////

    aligned = ALIGN_SORT(normalized, indexed_ref)

    ////////////////////////////////////////////////////
    // INDEX
    ////////////////////////////////////////////////////

    indexed = INDEX_BAM(aligned)

    ////////////////////////////////////////////////////
    // STATS
    ////////////////////////////////////////////////////

    BAM_STATS(indexed)

    ////////////////////////////////////////////////////
    // DUPLICATES
    ////////////////////////////////////////////////////

    dedup = MARK_DUPLICATES(indexed)

    ////////////////////////////////////////////////////
    // GVCF
    ////////////////////////////////////////////////////

    gvcfs_raw = HAPLOTYPE_CALLER(dedup, indexed_ref)

    gvcfs = INDEX_GVCF(gvcfs_raw)

    emit:
    gvcfs
}