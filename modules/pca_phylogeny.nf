include { INDEX_REF } from './alignment_variant.nf'

////////////////////////////////////////////////////
// PCA
////////////////////////////////////////////////////

process RUN_PCA {

    conda "bioconda::plink=1.9 r-base r-ggplot2 r-readr r-dplyr"
    publishDir "results/pca", mode: 'copy'

    input:
    path vcf
    path script_pca
    path script_plot

    output:
    path "pca_output/*.eigenvec", emit: eigenvec
    path "pca_output/*.eigenval", emit: eigenval
    path "pca_output/*.pdf", emit: pdf
    path "pca_done.txt", emit: done

    script:
    """
    bash $script_pca \
        $vcf \
        strain \
        pca_output \
        $script_plot

    touch pca_done.txt
    """
}

process PHYLO_SAMPLES_LIST {

    conda "bioconda::bcftools=1.19"

    publishDir "results/phylogeny", mode: 'copy'

    input:
    path vcf

    output:
    path "samples.list"

    script:
    """
    bcftools query -l $vcf > samples.list
    """
}

process PHYLO_FASTA_GENERATION {

    conda "bioconda::bcftools=1.19"

    publishDir "results/phylogeny/fasta", mode: 'copy'

    input:
    tuple path(vcf), path(vcf_index)
    path samples
    tuple path(ref), path(index_files)
    path script_fasta

    output:
    path "fasta"

    script:
    """
    mkdir -p fasta

    bash $script_fasta \
        $vcf \
        $ref \
        $samples \
        fasta
    """
}

process PHYLO_HEADER_FIX {

    publishDir "results/phylogeny/fasta_fixed", mode: 'copy'

    input:
    path fasta_dir
    path script_header

    output:
    path "fasta_fixed"

    script:
    """
    cp -r $fasta_dir fasta_fixed

    bash $script_header fasta_fixed
    """
}

process PHYLO_CONCAT_CHR {

    publishDir "results/phylogeny/fasta_concat", mode: 'copy'

    input:
    path fasta_dir
    path script_concat

    output:
    path "fasta_concat"

    script:
    """
    mkdir -p fasta_concat

    bash $script_concat \
        $fasta_dir \
        fasta_concat
    """
}

process PHYLO_MULTIFASTA {

    publishDir "results/phylogeny", mode: 'copy'

    input:
    path fasta_concat

    output:
    path "strain_snps_multialignment.fasta"

    script:
    """
    cat ${fasta_concat}/*.fasta > strain_snps_multialignment.fasta
    """
}

process PHYLO_TREE {

    conda "bioconda::iqtree=2.3.6"
    publishDir "results/phylogeny/tree", mode: 'copy'

    input:
    path multifasta

    output:
    path "phylogeny"

    script:
    """
    mkdir -p phylogeny

    iqtree \
      -s $multifasta \
      -m GTR+G \
      -B 1000 \
      --alrt 1000 \
      -nt AUTO \
      --prefix phylogeny/strain_tree
    """
}

workflow PCA_PHYLOGENY {

    take:
    vcf_pca
    vcf_phylo
    ref

    main:

    ////////////////////////////////////////////////////
    // SCRIPTS (IMPORTANTE!)
    ////////////////////////////////////////////////////

    script_pca    = Channel.fromPath("scripts/run_pca.sh")
    script_plot   = Channel.fromPath("scripts/plot_pca.R")
    script_fasta  = Channel.fromPath("scripts/vcf_generate_fasta2.sh")
    script_header = Channel.fromPath("scripts/fasta_header.adjust.sh")
    script_concat = Channel.fromPath("scripts/concat_chr.sh")

    ////////////////////////////////////////////////////
    // REFERÊNCIA
    ////////////////////////////////////////////////////

    indexed_ref = INDEX_REF(ref)

    ////////////////////////////////////////////////////
    // PCA
    ////////////////////////////////////////////////////

    pca = RUN_PCA(vcf_pca, script_pca, script_plot)
   
    ////////////////////////////////////////////////////
    // PHYLOGENY
    ////////////////////////////////////////////////////

    samples = PHYLO_SAMPLES_LIST(vcf_phylo.map{ it[0] })

    fasta = PHYLO_FASTA_GENERATION(
        vcf_phylo,
        samples,
        indexed_ref,
        script_fasta
    )

    header = PHYLO_HEADER_FIX(fasta, script_header)

    concat = PHYLO_CONCAT_CHR(header, script_concat)

    multi = PHYLO_MULTIFASTA(concat)

    tree = PHYLO_TREE(multi)

    ////////////////////////////////////////////////////
    // OUTPUT
    ////////////////////////////////////////////////////

    emit:
    pca_done = pca.done
    tree_done = tree
}
