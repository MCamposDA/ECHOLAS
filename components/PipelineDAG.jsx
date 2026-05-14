// Pipeline DAG visualization for ECHOLAS

const MODULES = [
  {
    id: 'M1',
    name: 'Trimming & QC',
    file: 'modules/trimming_qc.nf',
    processes: ['FASTQC_RAW', 'FASTQC_PARSE', 'TRIM_PE_CONSERVATIVE', 'TRIM_PE_INTERMEDIATE', 'TRIM_PE_AGGRESSIVE', 'TRIM_SE_BASIC', 'TRIM_SE_AGGRESSIVE', 'FASTQC_POST'],
    desc: 'Adaptive quality control. Routes reads to conservative / intermediate / aggressive trimming based on FastQC mean quality.',
  },
  {
    id: 'M2',
    name: 'Alignment & Variant Calling',
    file: 'modules/alignment_variant.nf',
    processes: ['INDEX_REF', 'ALIGN_SORT', 'INDEX_BAM', 'BAM_STATS', 'MARK_DUPLICATES', 'HAPLOTYPE_CALLER', 'INDEX_GVCF'],
    desc: 'BWA-MEM alignment to L. braziliensis reference, dedup with Picard, GATK HaplotypeCaller → gVCF.',
  },
  {
    id: 'M3',
    name: 'Joint Genotyping',
    file: 'modules/genotyping.nf',
    processes: ['MAKE_GVCF_MAP', 'MAKE_INTERVALS', 'GENOMICS_DB_IMPORT', 'GENOTYPE_GVCFS', 'CHECK_VCF'],
    desc: 'GenomicsDBImport then joint genotyping across all samples.',
  },
  {
    id: 'M4',
    name: 'Variant Filtering',
    file: 'modules/variant_filtering.nf',
    processes: ['SNP_EXTRACTION', 'SNP_FILTER_STRICT', 'SNP_FILTER_PCA', 'SNP_FILTER_PHYLO', 'SELECT_VARIANTS', 'FILTER_SNPS_GATK', 'FILTER_INDELS_GATK', 'FINAL_MERGE'],
    desc: 'Hard filters for SNPs and INDELs; produces dedicated VCFs for PCA (F_MISSING) and phylogeny (homozygous alt).',
  },
  {
    id: 'M5',
    name: 'PCA & Phylogeny',
    file: 'modules/pca_phylogeny.nf',
    processes: ['RUN_PCA', 'PHYLO_SAMPLES_LIST', 'PHYLO_FASTA_GENERATION', 'PHYLO_HEADER_FIX', 'PHYLO_CONCAT_CHR', 'PHYLO_MULTIFASTA', 'PHYLO_TREE'],
    desc: 'PLINK PCA + ggplot rendering. IQ-TREE GTR+G with 1000 ultrafast bootstraps + SH-aLRT.',
  },
];

function StatusDot({ status }) {
  const colors = {
    idle: '#c4c0b3',
    queued: '#c4c0b3',
    running: '#c98648',
    done: '#0d6e6e',
    error: '#b04848',
  };
  const pulse = status === 'running';
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
      {pulse && (
        <span style={{
          position: 'absolute', inset: -3, borderRadius: '50%',
          background: colors[status], opacity: 0.25,
          animation: 'echolas-pulse 1.6s ease-out infinite',
        }} />
      )}
      <span style={{
        width: 10, height: 10, borderRadius: '50%',
        background: colors[status],
        boxShadow: status === 'done' ? `0 0 0 3px ${colors[status]}22` : 'none',
      }} />
    </span>
  );
}

function ModuleCard({ mod, status, expanded, onToggle, processStatuses, isLast }) {
  const statusLabel = {
    idle: 'Idle',
    queued: 'Queued',
    running: 'Running',
    done: 'Done',
    error: 'Failed',
  }[status];

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={onToggle}
        style={{
          background: '#ffffff',
          border: '1px solid #e8e4d8',
          borderLeft: status === 'running'
            ? '3px solid #c98648'
            : status === 'done'
              ? '3px solid #0d6e6e'
              : status === 'error'
                ? '3px solid #b04848'
                : '3px solid #d8d4c7',
          borderRadius: 6,
          padding: '14px 18px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: expanded ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: '#8a8576',
            letterSpacing: '0.05em',
            minWidth: 28,
          }}>{mod.id}</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'Newsreader, serif',
              fontSize: 18,
              fontWeight: 500,
              color: '#1a1a1f',
              letterSpacing: '-0.01em',
            }}>{mod.name}</div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10.5,
              color: '#8a8576',
              marginTop: 2,
            }}>{mod.file} · {mod.processes.length} processes</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: status === 'running' ? '#c98648' : status === 'done' ? '#0d6e6e' : '#8a8576',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>{statusLabel}</span>
            <StatusDot status={status} />
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 14,
              color: '#8a8576',
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
              display: 'inline-block',
              width: 10,
            }}>›</span>
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #e8e4d8' }}>
            <div style={{
              fontFamily: 'Newsreader, serif',
              fontSize: 14,
              color: '#48463d',
              lineHeight: 1.55,
              fontStyle: 'italic',
              marginBottom: 12,
            }}>{mod.desc}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {mod.processes.map(p => {
                const ps = processStatuses[p] || 'idle';
                return (
                  <div key={p} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    color: ps === 'done' ? '#0d6e6e' : ps === 'running' ? '#c98648' : '#48463d',
                    padding: '4px 8px',
                    background: ps === 'running' ? '#fdf6ee' : ps === 'done' ? '#ecf3f2' : '#fafaf7',
                    border: '1px solid #efebe0',
                    borderRadius: 3,
                  }}>
                    <StatusDot status={ps} />
                    <span>{p}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {!isLast && (
        <div style={{
          width: 1,
          height: 14,
          background: '#d8d4c7',
          marginLeft: 30,
        }} />
      )}
    </div>
  );
}

function PipelineDAG({ moduleStatuses, processStatuses }) {
  const [expanded, setExpanded] = React.useState({});

  return (
    <div>
      {MODULES.map((mod, i) => (
        <ModuleCard
          key={mod.id}
          mod={mod}
          status={moduleStatuses[mod.id] || 'idle'}
          expanded={expanded[mod.id]}
          onToggle={() => setExpanded(s => ({ ...s, [mod.id]: !s[mod.id] }))}
          processStatuses={processStatuses}
          isLast={i === MODULES.length - 1}
        />
      ))}
    </div>
  );
}

Object.assign(window, { PipelineDAG, MODULES });
