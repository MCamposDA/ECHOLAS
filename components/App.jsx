// ECHOLAS — main app

function App() {
  const [runState, setRunState] = React.useState('idle'); // idle | running | done | error
  const [mode, setMode] = React.useState('AUTO');
  const [resume, setResume] = React.useState(false);
  const [moduleStatuses, setModuleStatuses] = React.useState({});
  const [processStatuses, setProcessStatuses] = React.useState({});
  const [log, setLog] = React.useState([]);
  const [activeProc, setActiveProc] = React.useState(null);

  const [rawFiles, setRawFiles] = React.useState(window.DEFAULT_RAW);
  const [refFile, setRefFile] = React.useState({
    name: 'GCF_000002845.2_ASM284v2_genomic.fna',
    path: 'reference/',
    size: '32.1 MB',
  });

  const [tab, setTab] = React.useState('pipeline'); // pipeline | results

  const samplesCount = React.useMemo(() => {
    const set = new Set();
    rawFiles.forEach(f => {
      const s = f.name.replace(/\.fastq\.gz$/, '').replace(/_R?[12]$/, '').replace(/_[12]$/, '');
      set.add(s);
    });
    return set.size;
  }, [rawFiles]);

  const completedModules = Object.values(moduleStatuses).filter(s => s === 'done').length;
  const runningModules = Object.values(moduleStatuses).filter(s => s === 'running').length;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafaf7',
      color: '#1a1a1f',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Top header */}
      <header style={{
        borderBottom: '1px solid #e8e4d8',
        background: '#fafaf7',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '18px 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <Wordmark />
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: '#8a8576',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                paddingBottom: 4,
              }}>v0.4.1 · nextflow 25.04</div>
            </div>
            <div style={{
              fontFamily: 'Newsreader, serif',
              fontSize: 14,
              color: '#48463d',
              fontStyle: 'italic',
              marginTop: 4,
            }}>
              Evolutionary Comparison and Hierarchical Organization on <span style={{ fontWeight: 500 }}>Leishmania</span> Analysis
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Stat label="reference" value="L. braziliensis M2904" mono />
            <Stat label="samples" value={samplesCount} />
            <Stat label="modules" value={`${completedModules}/5`} highlight={runningModules > 0} />
            <RunStatusPill state={runState} />
          </div>
        </div>
        {/* Sub-tabs */}
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 0, borderTop: '1px solid #f0ece0' }}>
          {[
            { id: 'pipeline', label: 'Pipeline' },
            { id: 'results',  label: 'Results' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #0d6e6e' : '2px solid transparent',
              color: tab === t.id ? '#0d6e6e' : '#8a8576',
              cursor: 'pointer',
              marginBottom: -1,
            }}>{t.label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: '#8a8576',
            padding: '12px 0',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span>~/projects/echolas</span>
            <span style={{ color: '#d8d4c7' }}>|</span>
            <span>local executor · 8 forks · 16-queue</span>
          </div>
        </div>
      </header>

      {/* Main area */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px 80px' }}>
        {tab === 'pipeline' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'flex-start' }}>
            <div>
              <SectionHeader
                roman="I"
                title="Pipeline modules"
                desc="Five modular workflows. Click any module to inspect its processes."
              />
              <PipelineDAG moduleStatuses={moduleStatuses} processStatuses={processStatuses} />

              <div style={{ height: 28 }} />

              <SectionHeader
                roman="II"
                title="Live execution log"
                desc="Streamed from .nextflow.log and process stdout/stderr."
              />
              <LogConsole log={log} activeProc={activeProc} runState={runState} />
            </div>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 130 }}>
              <RunPanel
                runState={runState} setRunState={setRunState}
                mode={mode} setMode={setMode}
                resume={resume} setResume={setResume}
                moduleStatuses={moduleStatuses} setModuleStatuses={setModuleStatuses}
                processStatuses={processStatuses} setProcessStatuses={setProcessStatuses}
                setLog={setLog}
                setActiveProc={setActiveProc}
              />
              <FileBrowser
                rawFiles={rawFiles} setRawFiles={setRawFiles}
                refFile={refFile} setRefFile={setRefFile}
              />
            </aside>
          </div>
        ) : (
          <div>
            <SectionHeader
              roman="III"
              title="Phylogenomic results"
              desc="PCA over filtered SNPs (F_MISSING ≤ 0.1) and IQ-TREE GTR+G phylogeny over homozygous variants."
            />
            <ResultsPanel runState={runState} openLog={() => {}} />

            <div style={{ height: 28 }} />

            <SectionHeader
              roman="IV"
              title="Output artifacts"
              desc="All files emitted to results/ during the most recent run."
            />
            <OutputTable runState={runState} />
          </div>
        )}
      </main>

      <footer style={{
        borderTop: '1px solid #e8e4d8',
        padding: '20px 32px',
        maxWidth: 1400,
        margin: '0 auto',
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        color: '#8a8576',
      }}>
        <span>ECHOLAS · pipeline visualization layer</span>
        <span>does not modify main.nf</span>
      </footer>
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width="34" height="34" viewBox="0 0 34 34" style={{ display: 'block' }}>
        <circle cx="17" cy="17" r="16" fill="none" stroke="#1a1a1f" strokeWidth="0.8" />
        <circle cx="17" cy="17" r="11" fill="none" stroke="#0d6e6e" strokeWidth="0.8" strokeDasharray="2 2" />
        <circle cx="17" cy="17" r="2.5" fill="#0d6e6e" />
        <line x1="17" y1="17" x2="28" y2="17" stroke="#0d6e6e" strokeWidth="0.8" />
        <line x1="17" y1="17" x2="13" y2="6" stroke="#1a1a1f" strokeWidth="0.6" />
        <line x1="17" y1="17" x2="9" y2="24" stroke="#1a1a1f" strokeWidth="0.6" />
        <line x1="17" y1="17" x2="25" y2="26" stroke="#1a1a1f" strokeWidth="0.6" />
        <circle cx="13" cy="6" r="1.4" fill="#1a1a1f" />
        <circle cx="9" cy="24" r="1.4" fill="#1a1a1f" />
        <circle cx="25" cy="26" r="1.4" fill="#1a1a1f" />
        <circle cx="28" cy="17" r="1.6" fill="#0d6e6e" />
      </svg>
      <span style={{
        fontFamily: 'Newsreader, serif',
        fontSize: 30,
        fontWeight: 500,
        color: '#1a1a1f',
        letterSpacing: '0.02em',
      }}>ECHOLAS</span>
    </div>
  );
}

function Stat({ label, value, mono, highlight }) {
  return (
    <div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: '#8a8576',
      }}>{label}</div>
      <div style={{
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'Newsreader, serif',
        fontStyle: mono ? 'normal' : 'italic',
        fontSize: mono ? 12 : 18,
        color: highlight ? '#c98648' : '#1a1a1f',
        marginTop: 2,
        fontWeight: mono ? 400 : 500,
      }}>{value}</div>
    </div>
  );
}

function RunStatusPill({ state }) {
  const cfg = {
    idle:    { color: '#8a8576', bg: '#f0ece0', label: 'Idle' },
    running: { color: '#c98648', bg: '#fdf6ee', label: 'Running' },
    done:    { color: '#0d6e6e', bg: '#ecf3f2', label: 'Complete' },
    error:   { color: '#b04848', bg: '#f7eaea', label: 'Failed' },
  }[state];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px',
      borderRadius: 999,
      background: cfg.bg,
      border: `1px solid ${cfg.color}30`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.color,
        animation: state === 'running' ? 'echolas-pulse 1.4s ease-out infinite' : 'none',
      }} />
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10.5,
        color: cfg.color,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>{cfg.label}</span>
    </div>
  );
}

function SectionHeader({ roman, title, desc }) {
  return (
    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 14 }}>
      <span style={{
        fontFamily: 'Newsreader, serif',
        fontStyle: 'italic',
        fontSize: 14,
        color: '#0d6e6e',
        fontWeight: 500,
      }}>§ {roman}</span>
      <div>
        <div style={{
          fontFamily: 'Newsreader, serif',
          fontSize: 24,
          color: '#1a1a1f',
          letterSpacing: '-0.01em',
        }}>{title}</div>
        <div style={{
          fontFamily: 'Newsreader, serif',
          fontSize: 14,
          color: '#48463d',
          fontStyle: 'italic',
          marginTop: 2,
        }}>{desc}</div>
      </div>
    </div>
  );
}

function OutputTable({ runState }) {
  const ready = runState === 'done';
  const rows = [
    { dir: 'results/fastqc/raw',         kind: 'HTML',  count: 18, size: '14.2 MB' },
    { dir: 'results/fastqc/post',        kind: 'HTML',  count: 18, size: '13.8 MB' },
    { dir: 'results/trimmed',            kind: 'FASTQ', count: 18, size: '4.1 GB' },
    { dir: 'results/alignments',         kind: 'BAM',   count: 9,  size: '8.7 GB' },
    { dir: 'results/alignments/statistics', kind: 'TXT',count: 18, size: '120 KB' },
    { dir: 'results/mapping',            kind: 'GVCF',  count: 9,  size: '482 MB' },
    { dir: 'results/genotyping/joint_vcf', kind: 'VCF',  count: 1,  size: '64 MB' },
    { dir: 'results/filtering/final',    kind: 'VCF',   count: 1,  size: '38 MB' },
    { dir: 'results/pca',                kind: 'PDF/EIG', count: 4, size: '2.1 MB' },
    { dir: 'results/phylogeny/tree',     kind: 'TREE',  count: 7,  size: '1.4 MB' },
  ];
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8e4d8',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 80px 80px 100px 80px',
        padding: '10px 16px',
        borderBottom: '1px solid #e8e4d8',
        background: '#f4f1e8',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#8a8576',
      }}>
        <span>directory</span>
        <span>type</span>
        <span style={{ textAlign: 'right' }}>files</span>
        <span style={{ textAlign: 'right' }}>size</span>
        <span></span>
      </div>
      {rows.map(r => (
        <div key={r.dir} style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 80px 80px 100px 80px',
          padding: '10px 16px',
          borderBottom: '1px solid #f0ece0',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: ready ? '#1a1a1f' : '#bcb8aa',
          alignItems: 'center',
        }}>
          <span>{r.dir}</span>
          <span style={{ color: '#8a8576' }}>{r.kind}</span>
          <span style={{ textAlign: 'right' }}>{ready ? r.count : '—'}</span>
          <span style={{ textAlign: 'right', color: '#8a8576' }}>{ready ? r.size : '—'}</span>
          <span style={{ textAlign: 'right' }}>
            {ready && <button style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9.5,
              padding: '2px 8px',
              background: 'transparent',
              border: '1px solid #d8d4c7',
              borderRadius: 3,
              color: '#48463d',
              cursor: 'pointer',
            }}>open</button>}
          </span>
        </div>
      ))}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
