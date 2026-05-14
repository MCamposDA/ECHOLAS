// File browser for raw_data/ and reference/

const DEFAULT_RAW = [
  { name: 'LbrM_BR_001_R1.fastq.gz', size: '482 MB', kind: 'paired', mate: 'R1' },
  { name: 'LbrM_BR_001_R2.fastq.gz', size: '491 MB', kind: 'paired', mate: 'R2' },
  { name: 'LbrM_BR_002_R1.fastq.gz', size: '376 MB', kind: 'paired', mate: 'R1' },
  { name: 'LbrM_BR_002_R2.fastq.gz', size: '381 MB', kind: 'paired', mate: 'R2' },
  { name: 'LbrM_PE_004_R1.fastq.gz', size: '512 MB', kind: 'paired', mate: 'R1' },
  { name: 'LbrM_PE_004_R2.fastq.gz', size: '519 MB', kind: 'paired', mate: 'R2' },
  { name: 'LinM_AM_011.fastq.gz',    size: '298 MB', kind: 'single' },
  { name: 'LguyM_GY_022.fastq.gz',   size: '264 MB', kind: 'single' },
  { name: 'LpanM_PA_017_R1.fastq.gz', size: '447 MB', kind: 'paired', mate: 'R1' },
  { name: 'LpanM_PA_017_R2.fastq.gz', size: '453 MB', kind: 'paired', mate: 'R2' },
];

function FileBrowser({ rawFiles, setRawFiles, refFile, setRefFile }) {
  const [picking, setPicking] = React.useState(null);
  const fileInputRef = React.useRef(null);

  const samples = React.useMemo(() => {
    const map = {};
    rawFiles.forEach(f => {
      const s = f.name
        .replace(/\.fastq\.gz$/, '')
        .replace(/_R?1$/, '').replace(/_R?2$/, '')
        .replace(/_1$/, '').replace(/_2$/, '');
      if (!map[s]) map[s] = [];
      map[s].push(f);
    });
    return map;
  }, [rawFiles]);

  const totalSize = rawFiles.reduce((acc, f) => acc + parseInt(f.size), 0);

  return (
    <div>
      {/* Reference */}
      <div style={{ marginBottom: 22 }}>
        <div style={sectionLabelStyle}>Reference Genome</div>
        <div style={{
          background: '#ffffff',
          border: '1px solid #e8e4d8',
          borderRadius: 4,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 3,
            background: '#0d6e6e15',
            border: '1px solid #0d6e6e30',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9, color: '#0d6e6e', fontWeight: 600,
          }}>FA</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: '#1a1a1f',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{refFile.name}</div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: '#8a8576',
              marginTop: 1,
            }}>{refFile.path} · {refFile.size}</div>
          </div>
          <button onClick={() => setPicking('ref')} style={ghostBtn}>change</button>
        </div>
      </div>

      {/* Raw data */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div style={sectionLabelStyle}>Raw Reads</div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: '#8a8576',
          }}>
            {Object.keys(samples).length} samples · {rawFiles.length} files · {totalSize.toLocaleString()} MB
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid #e8e4d8',
          borderRadius: 4,
          maxHeight: 360,
          overflowY: 'auto',
        }}>
          {Object.entries(samples).map(([sample, files]) => (
            <div key={sample} style={{
              borderBottom: '1px solid #f0ece0',
              padding: '8px 12px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 4,
              }}>
                <span style={{
                  fontFamily: 'Newsreader, serif',
                  fontSize: 13,
                  color: '#1a1a1f',
                  fontWeight: 500,
                }}>{sample}</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '1px 6px',
                  background: files[0].kind === 'paired' ? '#0d6e6e12' : '#c9864815',
                  color: files[0].kind === 'paired' ? '#0d6e6e' : '#a06a30',
                  borderRadius: 2,
                }}>{files[0].kind === 'paired' ? 'PE' : 'SE'}</span>
              </div>
              {files.map(f => (
                <div key={f.name} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10.5,
                  color: '#48463d',
                  padding: '2px 0',
                }}>
                  <span>{f.mate ? `${f.mate}  ` : '·   '}{f.name}</span>
                  <span style={{ color: '#8a8576' }}>{f.size}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={() => setPicking('raw')} style={ghostBtn}>+ add files</button>
          <button onClick={() => setRawFiles(DEFAULT_RAW)} style={ghostBtn}>reset</button>
          <button onClick={() => setRawFiles([])} style={ghostBtn}>clear</button>
        </div>
      </div>

      {picking && <FilePicker mode={picking} onClose={() => setPicking(null)} setRawFiles={setRawFiles} setRefFile={setRefFile} />}
    </div>
  );
}

const FAKE_FS = {
  '~/data/leishmania/raw_data': [
    { name: 'LbrM_BR_001_R1.fastq.gz', size: '482 MB', kind: 'paired', mate: 'R1' },
    { name: 'LbrM_BR_001_R2.fastq.gz', size: '491 MB', kind: 'paired', mate: 'R2' },
    { name: 'LbrM_BR_002_R1.fastq.gz', size: '376 MB', kind: 'paired', mate: 'R1' },
    { name: 'LbrM_BR_002_R2.fastq.gz', size: '381 MB', kind: 'paired', mate: 'R2' },
  ],
  '~/data/leishmania/extra_strains': [
    { name: 'LinM_AM_011.fastq.gz',    size: '298 MB', kind: 'single' },
    { name: 'LguyM_GY_022.fastq.gz',   size: '264 MB', kind: 'single' },
    { name: 'LamM_PE_033_R1.fastq.gz', size: '511 MB', kind: 'paired', mate: 'R1' },
    { name: 'LamM_PE_033_R2.fastq.gz', size: '518 MB', kind: 'paired', mate: 'R2' },
    { name: 'LbrM_CO_044_R1.fastq.gz', size: '402 MB', kind: 'paired', mate: 'R1' },
    { name: 'LbrM_CO_044_R2.fastq.gz', size: '408 MB', kind: 'paired', mate: 'R2' },
  ],
  '~/genomes/leishmania': [
    { name: 'GCF_000002845.2_ASM284v2_genomic.fna', size: '32.1 MB', kind: 'ref' },
    { name: 'TriTrypDB-68_LbraziliensisMHOMBR75M2904.fasta', size: '32.4 MB', kind: 'ref' },
    { name: 'LdonovaniBPK282A1.fasta', size: '32.6 MB', kind: 'ref' },
  ],
};

function FilePicker({ mode, onClose, setRawFiles, setRefFile }) {
  const dirs = mode === 'ref'
    ? ['~/genomes/leishmania']
    : ['~/data/leishmania/raw_data', '~/data/leishmania/extra_strains'];
  const [dir, setDir] = React.useState(dirs[0]);
  const [selected, setSelected] = React.useState(new Set());

  const files = FAKE_FS[dir] || [];
  const accepted = mode === 'ref'
    ? files.filter(f => f.kind === 'ref')
    : files.filter(f => f.kind !== 'ref');

  const toggle = (name) => {
    setSelected(s => {
      const ns = new Set(s);
      if (ns.has(name)) ns.delete(name); else ns.add(name);
      return ns;
    });
  };

  const apply = () => {
    if (mode === 'ref') {
      const f = accepted.find(a => selected.has(a.name));
      if (f) setRefFile({ name: f.name, path: dir + '/' + f.name, size: f.size });
    } else {
      const additions = accepted.filter(a => selected.has(a.name)).map(({ name, size, kind, mate }) => ({ name, size, kind, mate }));
      setRawFiles(prev => {
        const existing = new Set(prev.map(p => p.name));
        return [...prev, ...additions.filter(a => !existing.has(a.name))];
      });
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(20,18,12,0.35)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fafaf7',
        border: '1px solid #d8d4c7',
        borderRadius: 6,
        width: 620,
        maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #e8e4d8',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily: 'Newsreader, serif',
            fontSize: 18,
            color: '#1a1a1f',
          }}>{mode === 'ref' ? 'Select reference genome' : 'Add raw read files'}</div>
          <button onClick={onClose} style={{ ...ghostBtn, fontSize: 14 }}>×</button>
        </div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{
            width: 200,
            borderRight: '1px solid #e8e4d8',
            padding: 10,
            background: '#f4f1e8',
          }}>
            <div style={{ ...sectionLabelStyle, marginBottom: 6 }}>Browse</div>
            {dirs.map(d => (
              <div key={d} onClick={() => { setDir(d); setSelected(new Set()); }} style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10.5,
                padding: '6px 8px',
                marginBottom: 2,
                borderRadius: 3,
                cursor: 'pointer',
                background: dir === d ? '#0d6e6e15' : 'transparent',
                color: dir === d ? '#0d6e6e' : '#48463d',
                wordBreak: 'break-all',
              }}>📁 {d}</div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {accepted.map(f => (
              <div key={f.name} onClick={() => toggle(f.name)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px',
                borderRadius: 3,
                cursor: 'pointer',
                background: selected.has(f.name) ? '#0d6e6e10' : 'transparent',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: '#1a1a1f',
              }}>
                <input type="checkbox" checked={selected.has(f.name)} onChange={() => {}} style={{ accentColor: '#0d6e6e' }} />
                <span style={{ flex: 1 }}>{f.name}</span>
                <span style={{ color: '#8a8576' }}>{f.size}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{
          padding: 12,
          borderTop: '1px solid #e8e4d8',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button onClick={onClose} style={ghostBtn}>cancel</button>
          <button onClick={apply} style={primaryBtn} disabled={selected.size === 0}>
            {mode === 'ref' ? 'Use as reference' : `Add ${selected.size} file${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionLabelStyle = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#8a8576',
  marginBottom: 8,
};

const ghostBtn = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10.5,
  padding: '5px 10px',
  background: 'transparent',
  border: '1px solid #d8d4c7',
  borderRadius: 3,
  color: '#48463d',
  cursor: 'pointer',
  textTransform: 'lowercase',
  letterSpacing: '0.04em',
};

const primaryBtn = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10.5,
  padding: '5px 12px',
  background: '#0d6e6e',
  border: '1px solid #0d6e6e',
  borderRadius: 3,
  color: '#fafaf7',
  cursor: 'pointer',
  textTransform: 'lowercase',
  letterSpacing: '0.04em',
};

Object.assign(window, { FileBrowser, DEFAULT_RAW });
