nextflow.enable.dsl=2

params.mode = "AUTO"

////////////////////////////////////////////////////
/// FASTQC PRÉ
////////////////////////////////////////////////////

process FASTQC_RAW {

    conda "bioconda::fastqc=0.12.1"
    publishDir "results/fastqc/raw", mode: 'copy', pattern: "*.html"
    cpus 2

    input:
    tuple val(sample), path(reads)

    output:
    tuple val(sample), path("*.zip"), emit: zip
    tuple val(sample), path("*.html"), emit: html

    script:
    """
    fastqc $reads --threads ${task.cpus}
    """
}

////////////////////////////////////////////////////
/// EXTRAI Q MÉDIO DO FASTQC
////////////////////////////////////////////////////

process FASTQC_PARSE {

    conda "conda-forge::unzip"

    input:
    tuple val(sample), path(zipfile)

    output:
    tuple val(sample), stdout

    script:
    """
    unzip -p $zipfile */fastqc_data.txt | \
    awk '
    BEGIN{sum=0;count=0}
    /^>>Per base sequence quality/{flag=1;next}
    /^>>END_MODULE/{flag=0}
    flag && /^[0-9]/ {sum+=\$2; count++}
    END{if(count>0) print sum/count; else print 0}
    '
    """
}

////////////////////////////////////////////////////
/// TRIMMING PE CONSERVATIVE — TRIMMOMATIC
////////////////////////////////////////////////////

process TRIM_PE_CONSERVATIVE {

    conda "bioconda::trimmomatic=0.40"
    publishDir "results/trimmed/pe_conservative", mode: 'copy'
    cpus 2
    memory '7 GB'

    input:
    tuple val(sample), path(r1), path(r2)

    output:
    tuple val(sample), path("*_paired.fastq.gz")

    script:
    """
    trimmomatic PE \
      -threads ${task.cpus} \
      -Xmx6G \
      $r1 $r2 \
      ${sample}_R1_paired.fastq.gz ${sample}_R1_unpaired.fastq.gz \
      ${sample}_R2_paired.fastq.gz ${sample}_R2_unpaired.fastq.gz \
      ILLUMINACLIP:TruSeq3-PE.fa:2:30:10 \
      LEADING:20 TRAILING:20 \
      SLIDINGWINDOW:4:20 \
      MINLEN:36
    """
}

////////////////////////////////////////////////////
/// TRIMMING PE INTERMEDIATE — FASTP
////////////////////////////////////////////////////

process TRIM_PE_INTERMEDIATE {

    conda "bioconda::fastp=1.0.1"
    publishDir "results/trimmed/pe_intermediate", mode: 'copy'
    cpus 4

    input:
    tuple val(sample), path(r1), path(r2)

    output:
    tuple val(sample), path("*_trimmed.fastq.gz")

    script:
    """
    fastp \
      -i $r1 -I $r2 \
      -o ${sample}_R1_trimmed.fastq.gz \
      -O ${sample}_R2_trimmed.fastq.gz \
      --qualified_quality_phred 25 \
      --length_required 50 \
      --detect_adapter_for_pe \
      --trim_poly_g \
      --trim_poly_x \
      --low_complexity_filter \
      --thread ${task.cpus}
    """
}

////////////////////////////////////////////////////
/// TRIMMING PE AGGRESSIVE — FASTP
////////////////////////////////////////////////////

process TRIM_PE_AGGRESSIVE {

    conda "bioconda::fastp=1.0.1"
    publishDir "results/trimmed/pe_aggressive", mode: 'copy'
    cpus 4

    input:
    tuple val(sample), path(r1), path(r2)

    output:
    tuple val(sample), path("*_trimmed.fastq.gz")

    script:
    """
    fastp \
      -i $r1 -I $r2 \
      -o ${sample}_R1_trimmed.fastq.gz \
      -O ${sample}_R2_trimmed.fastq.gz \
      --qualified_quality_phred 30 \
      --length_required 50 \
      --detect_adapter_for_pe \
      --trim_poly_g \
      --trim_poly_x \
      --low_complexity_filter \
      --complexity_threshold 30 \
      --thread ${task.cpus}
    """
}

////////////////////////////////////////////////////
/// TRIMMING SE BASIC — FASTP
////////////////////////////////////////////////////

process TRIM_SE_BASIC {

    conda "bioconda::fastp=1.0.1"
    publishDir "results/trimmed/se_basic", mode: 'copy'
    cpus 2

    input:
    tuple val(sample), path(read)

    output:
    tuple val(sample), path("*_trimmed.fastq.gz")

    script:
    """
    fastp \
      -i $read \
      -o ${sample}_trimmed.fastq.gz \
      --qualified_quality_phred 20 \
      --length_required 36 \
      --thread ${task.cpus}
    """
}

////////////////////////////////////////////////////
/// TRIMMING SE AGGRESSIVE — FASTP
////////////////////////////////////////////////////

process TRIM_SE_AGGRESSIVE {

    conda "bioconda::fastp=1.0.1"
    publishDir "results/trimmed/se_aggressive", mode: 'copy'
    cpus 2

    input:
    tuple val(sample), path(read)

    output:
    tuple val(sample), path("*_trimmed.fastq.gz")

    script:
    """
    fastp \
      -i $read \
      -o ${sample}_trimmed.fastq.gz \
      --qualified_quality_phred 30 \
      --length_required 50 \
      --trim_poly_g \
      --trim_poly_x \
      --low_complexity_filter \
      --complexity_threshold 30 \
      --thread ${task.cpus}
    """
}

////////////////////////////////////////////////////
/// FASTQC PÓS
////////////////////////////////////////////////////

process FASTQC_POST {

    conda "bioconda::fastqc=0.12.1"
    publishDir "results/fastqc/post", mode: 'copy', pattern: "*.html"
    cpus 2

    input:
    tuple val(sample), path(reads)

    output:
    tuple val(sample), path("*.zip"), emit: zip
    tuple val(sample), path("*.html"), emit: html

    script:
    """
    fastqc $reads --threads ${task.cpus}
    """
}

////////////////////////////////////////////////////
/// WORKFLOW PRINCIPAL
////////////////////////////////////////////////////

workflow TRIMMING_QC {

    take:
    reads

    main:
    def mode = params.mode ?: "AUTO"

    ////////////////////////////////////////////////////
    // FASTQC PRÉ
    ////////////////////////////////////////////////////

    qc = FASTQC_RAW(reads)

    qmetrics = FASTQC_PARSE(qc.zip)
        .map { s, q -> tuple(s, q as double) }

    ////////////////////////////////////////////////////
    // DETECÇÃO PE REAL (compatível Nextflow 25+)
    ////////////////////////////////////////////////////

    classified = reads.map { sample, f ->

        def role =
            f.name =~ /_R?1(_|\.)/ ? "R1" :
            f.name =~ /_R?2(_|\.)/ ? "R2" :
            "SE"

        tuple(sample, role, f)
    }

    grouped = classified.groupTuple(by: 0)

    paired = grouped
        .filter { sample, roles, files ->
            roles.contains("R1") && roles.contains("R2")
        }
        .map { sample, roles, files ->

            def r1 = files[ roles.indexOf("R1") ]
            def r2 = files[ roles.indexOf("R2") ]

            tuple(sample, r1, r2)
        }

    paired_samples = paired.map { s,r1,r2 -> s }

    single = grouped
        .filter { sample, roles, files ->
            !(roles.contains("R1") && roles.contains("R2"))
        }
        .flatMap { sample, roles, files ->
            files.collect { f -> tuple(sample, f) }
        }

    ////////////////////////////////////////////////////
    // AUTO MODE — PE
    ////////////////////////////////////////////////////

    if (mode == "AUTO") {

        pe = paired.join(qmetrics)

        TRIM_PE_CONSERVATIVE(
            pe.filter { s,r1,r2,q -> q >= 30 }
              .map { s,r1,r2,q -> tuple(s,r1,r2) }
        )

        TRIM_PE_INTERMEDIATE(
            pe.filter { s,r1,r2,q -> q < 30 && q >= 25 }
              .map { s,r1,r2,q -> tuple(s,r1,r2) }
        )

        TRIM_PE_AGGRESSIVE(
            pe.filter { s,r1,r2,q -> q < 25 }
              .map { s,r1,r2,q -> tuple(s,r1,r2) }
        )

        ////////////////////////////////////////////////////
        // AUTO MODE — SE
        ////////////////////////////////////////////////////

        se = single.join(qmetrics)

        TRIM_SE_BASIC(
            se.filter { s,r,q -> q >= 28 }
              .map { s,r,q -> tuple(s,r) }
        )

        TRIM_SE_AGGRESSIVE(
            se.filter { s,r,q -> q < 28 }
              .map { s,r,q -> tuple(s,r) }
        )
    }

    ////////////////////////////////////////////////////
    // FASTQC PÓS
    ////////////////////////////////////////////////////

    trimmed =
        TRIM_PE_CONSERVATIVE.out
        .mix(TRIM_PE_INTERMEDIATE.out)
        .mix(TRIM_PE_AGGRESSIVE.out)
        .mix(TRIM_SE_BASIC.out)
        .mix(TRIM_SE_AGGRESSIVE.out)

    FASTQC_POST(trimmed)

    emit:
    trimmed_reads = trimmed
}
