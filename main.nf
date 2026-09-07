nextflow.enable.dsl=2

////////////////////////////////////////////////////
//// IMPORTS
////////////////////////////////////////////////////

include { TRIMMING_QC } from './modules/trimming_qc.nf'
include { ALIGNMENT_VARIANT } from './modules/alignment_variant.nf'
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
    // INPUT
    ////////////////////////////////////////////////////

   ref = Channel
    .fromPath(params.reference, checkIfExists: true)
    .first()

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

    alignment_out = ALIGNMENT_VARIANT(
    trimming_out.trimmed_reads,
    ref
)

    ////////////////////////////////////////////////////
    // MÓDULO 3 — GENOTYPING
    ////////////////////////////////////////////////////

    genotyped = GENOTYPING(
    alignment_out.gvcfs,
    ref
)

    ////////////////////////////////////////////////////
    // MÓDULO 4 - VARIANT_FILTERING
    ///////////////////////////////////////////////////

    variant_filtering = VARIANT_FILTERING(
    genotyped,
    ref
)

    ////////////////////////////////////////////////////
    // MÓDULO 5 - PCA_PHYLOGENY     
    ///////////////////////////////////////////////////

    pca_phylo = PCA_PHYLOGENY(
    variant_filtering.vcf_pca,
    variant_filtering.vcf_phylo,
    ref
)

}
