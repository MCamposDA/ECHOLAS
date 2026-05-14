// Run panel: command preview, mode toggle, run/stop, live log

const SEQUENCE = [
  { mod: 'M1', proc: 'FASTQC_RAW',           ms: 700 },
  { mod: 'M1', proc: 'FASTQC_PARSE',         ms: 250 },
  { mod: 'M1', proc: 'TRIM_PE_INTERMEDIATE', ms: 600 },
  { mod: 'M1', proc: 'TRIM_PE_AGGRESSIVE',   ms: 600 },
  { mod: 'M1', proc: 'TRIM_SE_AGGRESSIVE',   ms: 500 },
  { mod: 'M1', proc: 'FASTQC_POST',          ms: 500 },
  { mod: 'M2', proc: 'INDEX_REF',            ms: 350 },
  { mod: 'M2', proc: 'ALIGN_SORT',           ms: 1100 },
  { mod: 'M2', proc: 'INDEX_BAM',            ms: 250 },
  { mod: 'M2', proc: 'BAM_STATS',            ms: 300 },
  { mod: 'M2', proc: 'MARK_DUPLICATES',      ms: 500 },
  { mod: 'M2', proc: 'HAPLOTYPE_CALLER',     ms: 1300 },
  { mod: 'M2', proc: 'INDEX_GVCF',           ms: 200 },
  { mod: 'M3', proc: 'MAKE_GVCF_MAP',        ms: 200 },
  { mod: 'M3', proc: 'MAKE_INTERVALS',       ms: 150 },
  { mod: 'M3', proc: 'GENOMICS_DB_IMPORT',   ms: 750 },
  { mod: 'M3', proc: 'GENOTYPE_GVCFS',       ms: 900 },
  { mod: 'M3', proc: 'CHECK_VCF',            ms: 200 },
  { mod: 'M4', proc: 'SNP_EXTRACTION',       ms: 350 },
  { mod: 'M4', proc: 'SNP_FILTER_STRICT',    ms: 300 },
  { mod: 'M4', proc: 'SNP_FILTER_PCA',       ms: 250 },
  { mod: 'M4', proc: 'SNP_FILTER_PHYLO',     ms: 250 },
  { mod: 'M4', proc: 'SELECT_VARIANTS',      ms: 400 },
  { mod: 'M4', proc: 'FILTER_SNPS_GATK',     ms: 350 },
  { mod: 'M4', proc: 'FILTER_INDELS_GATK',   ms: 350 },
  { mod: 'M4', proc: 'FINAL_MERGE',          ms: 300 },
  { mod: 'M5', proc: 'RUN_PCA',              ms: 700 },
  { mod: 'M5', proc: 'PHYLO_SAMPLES_LIST',   ms: 200 },
  { mod: 'M5', proc: 'PHYLO_FASTA_GENERATION', ms: 800 },
  { mod: 'M5', proc: 'PHYLO_HEADER_FIX',     ms: 200 },
  { mod: 'M5', proc: 'PHYLO_CONCAT_CHR',     ms: 250 },
  { mod: 'M5', proc: 'PHYLO_MULTIFASTA',     ms: 150 },
  { mod: 'M5', proc: 'PHYLO_TREE',           ms: 1500 },
];

function RunPanel({
  runState, setRunState,
  mode, setMode,
  resume, setResume,
  moduleStatuses, setModuleStatuses,
  processStatuses, setProcessStatuses,
  setLog, setActiveProc,
}) {
  const tickRef = React.useRef(null);

  const reset = () => {
    setModuleStatuses({});
    setProcessStatuses({});
    setLog([]);
    setActiveProc(null);
  };

  const start = () => {
    reset();
    setRunState('running');
    const startedAt = Date.now();
    const cmd = `nextflow run main.nf --mode ${mode}${resume ? ' -resume' : ''}`;
    const logLines = [
      { t: 0, kind: 'cmd', text: `$ ${cmd}` },
      { t: 100, kind: 'sys', text: 'N E X T F L O W   ~  version 25.04.2' },
      { t: 200, kind: 'sys', text: 'Launching `main.nf` [echolas_run] DSL2 - revision: 8c1f4a2' },
      { t: 300, kind: 'sys', text: 'executor >  local (8)' },
    ];
    setLog(logLines);

    let i = 0;
    let elapsed = 400;
    const next = () => {
      if (i >= SEQUENCE.length) {
        setLog(prev => [
          ...prev,
          { t: Date.now() - startedAt, kind: 'sys', text: '' },
          { t: Date.now() - startedAt, kind: 'ok', text: `Completed at: ${new Date().toLocaleString()}` },
          { t: Date.now() - startedAt, kind: 'ok', text: `Duration    : ${((Date.now() - startedAt) / 1000).toFixed(1)} s` },
          { t: Date.now() - startedAt, kind: 'ok', text: 'Succeeded   : 33' },
        ]);
        setRunState('done');
        return;
      }
      const step = SEQUENCE[i];
      // Mark running
      setProcessStatuses(s => ({ ...s, [step.proc]: 'running' }));
      setModuleStatuses(s => ({ ...s, [step.mod]: 'running' }));
      setActiveProc(step.proc);
      const hash = Math.random().toString(36).slice(2, 6) + '/' + Math.random().toString(36).slice(2, 8);
      setLog(prev => [...prev, {
        t: Date.now() - startedAt,
        kind: 'proc',
        text: `[${hash}] Submitted process > ${step.proc} (${step.mod})`,
      }]);

      tickRef.current = setTimeout(() => {
        setProcessStatuses(s => ({ ...s, [step.proc]: 'done' }));
        // Mark module done if it's the last process for that module in remaining
        const remainingForMod = SEQUENCE.slice(i + 1).some(x => x.mod === step.mod);
        if (!remainingForMod) {
          setModuleStatuses(s => ({ ...s, [step.mod]: 'done' }));
        }
        i++;
        elapsed += step.ms;
        next();
      }, step.ms / 4); // accelerated for demo
    };
    next();
  };

  const stop = () => {
    if (tickRef.current) clearTimeout(tickRef.current);
    setRunState('idle');
    setLog(prev => [...prev, { t: 0, kind: 'err', text: '✗ Run aborted by user' }]);
    setModuleStatuses(s => {
      const ns = { ...s };
      Object.keys(ns).forEach(k => { if (ns[k] === 'running') ns[k] = 'idle'; });
      return ns;
    });
  };

  React.useEffect(() => () => tickRef.current && clearTimeout(tickRef.current), []);

  const cmd = `nextflow run main.nf --mode ${mode}${resume ? ' -resume' : ''}`;

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8e4d8',
      borderRadius: 6,
      padding: 16,
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: '#8a8576',
        marginBottom: 10,
      }}>Execution</div>

      {/* Mode selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={miniLabel}>--mode</div>
        <div style={{ display: 'flex', gap: 4, background: '#f4f1e8', padding: 3, borderRadius: 4, border: '1px solid #e8e4d8' }}>
          {['AUTO', 'STRICT', 'CUSTOM'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10.5,
              padding: '5px 8px',
              background: mode === m ? '#1a1a1f' : 'transparent',
              color: mode === m ? '#fafaf7' : '#48463d',
              border: 'none',
              borderRadius: 2,
              cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Resume toggle */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color: '#48463d',
        cursor: 'pointer',
        padding: '6px 0',
        marginBottom: 10,
      }}>
        <input type="checkbox" checked={resume} onChange={e => setResume(e.target.checked)} style={{ accentColor: '#0d6e6e' }} />
        <span>-resume (use cached work-dir)</span>
      </label>

      {/* Command preview */}
      <div style={{
        background: '#1a1a1f',
        color: '#e8e4d8',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10.5,
        padding: '10px 12px',
        borderRadius: 4,
        marginBottom: 12,
        overflow: 'auto',
      }}>
        <span style={{ color: '#8a8576' }}>$ </span>
        <span style={{ color: '#0d6e6e', fontWeight: 600 }}>nextflow </span>
        <span>run main.nf </span>
        <span style={{ color: '#c98648' }}>--mode</span>
        <span> {mode}</span>
        {resume && <span style={{ color: '#c98648' }}> -resume</span>}
      </div>

      {/* Run / Stop */}
      <div style={{ display: 'flex', gap: 8 }}>
        {runState !== 'running' ? (
          <button onClick={start} style={{
            flex: 1,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            padding: '10px 16px',
            background: '#0d6e6e',
            color: '#fafaf7',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            letterSpacing: '0.04em',
            textTransform: 'lowercase',
            fontWeight: 600,
          }}>▶ {runState === 'done' ? 're-run pipeline' : 'run pipeline'}</button>
        ) : (
          <button onClick={stop} style={{
            flex: 1,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            padding: '10px 16px',
            background: '#b04848',
            color: '#fafaf7',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            letterSpacing: '0.04em',
            textTransform: 'lowercase',
            fontWeight: 600,
          }}>■ stop</button>
        )}
      </div>

      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9.5,
        color: '#8a8576',
        marginTop: 10,
        lineHeight: 1.5,
      }}>
        Runs in the project working directory. Conda environments resolved per-process.
      </div>
    </div>
  );
}

const miniLabel = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9.5,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#8a8576',
  marginBottom: 4,
};

function LogConsole({ log, activeProc, runState }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);

  const colorMap = {
    cmd: '#fafaf7',
    sys: '#8a8576',
    proc: '#0d8a8a',
    ok: '#5fa05f',
    err: '#c98080',
  };

  return (
    <div style={{
      background: '#1a1a1f',
      borderRadius: 6,
      overflow: 'hidden',
      border: '1px solid #2a2a2f',
    }}>
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid #2a2a2f',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#15151a',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: '#8a8576',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%',
            background: runState === 'running' ? '#c98648' : runState === 'done' ? '#0d8a8a' : '#48463d',
          }} />
          .nextflow.log
          {activeProc && runState === 'running' && (
            <span style={{ color: '#c98648', textTransform: 'none', letterSpacing: 0 }}>
              · {activeProc}
            </span>
          )}
        </div>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: '#48463d',
        }}>{log.length} lines</div>
      </div>
      <div ref={ref} style={{
        height: 200,
        overflowY: 'auto',
        padding: '10px 14px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10.5,
        lineHeight: 1.55,
      }}>
        {log.length === 0 && (
          <div style={{ color: '#48463d', fontStyle: 'italic' }}>
            Awaiting run. Click ▶ run pipeline to begin.
          </div>
        )}
        {log.map((l, i) => (
          <div key={i} style={{ color: colorMap[l.kind] || '#e8e4d8' }}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { RunPanel, LogConsole, SEQUENCE });
