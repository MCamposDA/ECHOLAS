nextflow.enable.dsl=2

////////////////////////////////////////////////////
//// IMPORTS
////////////////////////////////////////////////////

include { TRIMMING_QC } from './modules/trimming_qc.nf'
include { ALIGNMENT_VARIANT; INDEX_REF } from './modules/alignment_variant.nf'
include { GENOTYPING } from './modules/genotyping.nf'
include { VARIANT_FILTERING } from './modules/variant_filtering.nf'
include { PCA_PHYLOGENY } from './modules/pca_phylogeny.nf'

////////////////////////////////////////////////////
//// PARAMS
////////////////////////////////////////////////////

params.mode = params.mode ?: "AUTO"

////////////////////////////////////////////////////
//// WORKFLOW PRINCIPAL
////////////////////////////////////////////////////

workflow {

    ////////////////////////////////////////////////////
    // REFERÊNCIA (resolvida e indexada uma única vez)
    ////////////////////////////////////////////////////

    ref_files = file("reference/*.{fna,fa,fasta}", checkIfExists: false)
    if (ref_files.size() == 0) {
        error "No reference genome found in reference/ (expected a .fna, .fa or .fasta file)"
    }
    if (ref_files.size() > 1) {
        error "Multiple reference genomes found in reference/ (${ref_files*.name}) — keep only one .fna/.fa/.fasta file"
    }
    ref = Channel.value(ref_files[0])
    indexed_ref = INDEX_REF(ref)

    ////////////////////////////////////////////////////
    // INPUT
    ////////////////////////////////////////////////////

    reads = Channel
        .fromPath("raw_data/*.fastq.gz")
        .map { f ->

            def sample = f.simpleName
                .replace("_R1","")
                .replace("_R2","")
                .replace("_1","")
                .replace("_2","")

            tuple(sample, f)
        }

    ////////////////////////////////////////////////////
    // MÓDULO 1 — TRIMMING
    ////////////////////////////////////////////////////

    trimming_out = TRIMMING_QC(reads)

    ////////////////////////////////////////////////////
    // MÓDULO 2 — ALIGNMENT + GVCF
    ////////////////////////////////////////////////////

    alignment_out = ALIGNMENT_VARIANT(trimming_out.trimmed_reads, indexed_ref)

    ////////////////////////////////////////////////////
    // MÓDULO 3 — GENOTYPING
    ////////////////////////////////////////////////////

    genotyped = GENOTYPING(alignment_out.gvcfs, indexed_ref)

    ////////////////////////////////////////////////////
    // MÓDULO 4 - VARIANT_FILTERING
    ///////////////////////////////////////////////////

    variant_filtering = VARIANT_FILTERING(genotyped, indexed_ref)

    ////////////////////////////////////////////////////
    // MÓDULO 5 - PCA_PHYLOGENY
    ///////////////////////////////////////////////////

    pca_phylo = PCA_PHYLOGENY(
        variant_filtering.vcf_pca,
        variant_filtering.vcf_phylo,
        indexed_ref
    )

}