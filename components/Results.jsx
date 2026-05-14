// Results: PCA + Phylogeny side-by-side, plus logs drawer

function PCAPlot() {
  // Static SVG mock of a PCA scatter — labelled L. braziliensis cluster + outliers
  const points = [
    { x: 0.18, y: 0.22, label: 'LbrM_BR_001', sp: 'braziliensis' },
    { x: 0.22, y: 0.19, label: 'LbrM_BR_002', sp: 'braziliensis' },
    { x: 0.16, y: 0.27, label: 'LbrM_PE_004', sp: 'braziliensis' },
    { x: 0.21, y: 0.24, label: 'LbrM_CO_044', sp: 'braziliensis' },
    { x: 0.19, y: 0.21, label: 'M2904_ref',   sp: 'braziliensis', ref: true },
    { x: 0.62, y: 0.74, label: 'LguyM_GY_022', sp: 'guyanensis' },
    { x: 0.58, y: 0.71, label: 'LpanM_PA_017', sp: 'panamensis' },
    { x: 0.55, y: 0.66, label: 'LamM_PE_033',  sp: 'amazonensis' },
    { x: 0.78, y: 0.30, label: 'LinM_AM_011',  sp: 'infantum' },
  ];
  const speciesColor = {
    braziliensis: '#0d6e6e',
    guyanensis: '#c98648',
    panamensis: '#a06a30',
    amazonensis: '#7a3f8a',
    infantum: '#3d6e9c',
  };
  const W = 360, H = 260, pad = 30;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <rect x={0} y={0} width={W} height={H} fill="#fafaf7" />
      {/* Grid */}
      {[0.25, 0.5, 0.75].map(t => (
        <g key={t}>
          <line x1={pad + t * (W - pad - 10)} x2={pad + t * (W - pad - 10)} y1={pad / 2} y2={H - pad} stroke="#efebe0" strokeDasharray="2 3" />
          <line x1={pad} x2={W - 10} y1={pad / 2 + t * (H - pad - 10)} y2={pad / 2 + t * (H - pad - 10)} stroke="#efebe0" strokeDasharray="2 3" />
        </g>
      ))}
      {/* Axes */}
      <line x1={pad} x2={pad} y1={pad / 2} y2={H - pad} stroke="#1a1a1f" strokeWidth="0.8" />
      <line x1={pad} x2={W - 10} y1={H - pad} y2={H - pad} stroke="#1a1a1f" strokeWidth="0.8" />
      {/* Cluster ellipse for braziliensis */}
      <ellipse cx={pad + 0.19 * (W - pad - 10)} cy={pad / 2 + 0.23 * (H - pad - 10)}
        rx={32} ry={22}
        fill="#0d6e6e08" stroke="#0d6e6e60" strokeDasharray="3 3" strokeWidth="0.8" />
      {/* Points */}
      {points.map(p => {
        const cx = pad + p.x * (W - pad - 10);
        const cy = pad / 2 + p.y * (H - pad - 10);
        return (
          <g key={p.label}>
            <circle cx={cx} cy={cy} r={p.ref ? 5 : 4}
              fill={speciesColor[p.sp]}
              fillOpacity={p.ref ? 0.3 : 0.85}
              stroke={speciesColor[p.sp]} strokeWidth={p.ref ? 1.5 : 0.5} />
            <text x={cx + 6} y={cy + 3}
              fontFamily="JetBrains Mono, monospace"
              fontSize="6.5"
              fill="#48463d">{p.label}</text>
          </g>
        );
      })}
      {/* Axis labels */}
      <text x={W / 2} y={H - 8} textAnchor="middle"
        fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#48463d">PC1 (47.3%)</text>
      <text x={10} y={H / 2} transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle"
        fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#48463d">PC2 (21.8%)</text>
    </svg>
  );
}

function PhyloTree() {
  // Simplified Newick-style cladogram
  const tips = [
    { y: 28,  label: 'M2904_ref',     branch: 0.92, sp: 'braziliensis', bs: 100 },
    { y: 50,  label: 'LbrM_BR_001',   branch: 0.88, sp: 'braziliensis', bs: 99 },
    { y: 72,  label: 'LbrM_BR_002',   branch: 0.86, sp: 'braziliensis', bs: 98 },
    { y: 94,  label: 'LbrM_PE_004',   branch: 0.84, sp: 'braziliensis', bs: 97 },
    { y: 116, label: 'LbrM_CO_044',   branch: 0.82, sp: 'braziliensis', bs: 95 },
    { y: 144, label: 'LpanM_PA_017',  branch: 0.74, sp: 'panamensis',   bs: 92 },
    { y: 166, label: 'LguyM_GY_022',  branch: 0.72, sp: 'guyanensis',   bs: 88 },
    { y: 192, label: 'LamM_PE_033',   branch: 0.55, sp: 'amazonensis',  bs: 96 },
    { y: 222, label: 'LinM_AM_011',   branch: 0.42, sp: 'infantum',     bs: 100 },
  ];
  const speciesColor = {
    braziliensis: '#0d6e6e',
    guyanensis: '#c98648',
    panamensis: '#a06a30',
    amazonensis: '#7a3f8a',
    infantum: '#3d6e9c',
  };
  const W = 360, H = 260;
  const xScale = (b) => 30 + b * 220;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <rect x={0} y={0} width={W} height={H} fill="#fafaf7" />
      {/* Nodes — manually drawn cladogram */}
      {/* Root */}
      <line x1={30} x2={30} y1={28} y2={222} stroke="#1a1a1f" strokeWidth="1" />
      {/* Braziliensis clade */}
      <line x1={30} x2={70} y1={28} y2={28} stroke="#0d6e6e" strokeWidth="1.2" />
      <line x1={70} x2={70} y1={28} y2={116} stroke="#0d6e6e" strokeWidth="1.2" />
      <line x1={70} x2={120} y1={28} y2={28} stroke="#0d6e6e" strokeWidth="1.2" />
      <line x1={70} x2={120} y1={50} y2={50} stroke="#0d6e6e" strokeWidth="1.2" />
      <line x1={70} x2={120} y1={72} y2={72} stroke="#0d6e6e" strokeWidth="1.2" />
      <line x1={70} x2={120} y1={94} y2={94} stroke="#0d6e6e" strokeWidth="1.2" />
      <line x1={70} x2={120} y1={116} y2={116} stroke="#0d6e6e" strokeWidth="1.2" />
      {/* Viannia subgenus group */}
      <line x1={30} x2={50} y1={155} y2={155} stroke="#1a1a1f" strokeWidth="1" />
      <line x1={50} x2={50} y1={144} y2={166} stroke="#48463d" strokeWidth="1" />
      <line x1={50} x2={120} y1={144} y2={144} stroke={speciesColor.panamensis} strokeWidth="1.2" />
      <line x1={50} x2={120} y1={166} y2={166} stroke={speciesColor.guyanensis} strokeWidth="1.2" />
      {/* Amazonensis */}
      <line x1={30} x2={120} y1={192} y2={192} stroke={speciesColor.amazonensis} strokeWidth="1.2" />
      {/* Infantum (outgroup) */}
      <line x1={30} x2={120} y1={222} y2={222} stroke={speciesColor.infantum} strokeWidth="1.2" />

      {/* Tips */}
      {tips.map(t => (
        <g key={t.label}>
          <line x1={120} x2={xScale(t.branch)} y1={t.y} y2={t.y} stroke={speciesColor[t.sp]} strokeWidth="1" strokeDasharray="2 2" />
          <circle cx={xScale(t.branch)} cy={t.y} r={2.5} fill={speciesColor[t.sp]} />
          <text x={xScale(t.branch) + 6} y={t.y + 3}
            fontFamily="JetBrains Mono, monospace"
            fontSize="7"
            fill="#1a1a1f">{t.label}</text>
        </g>
      ))}
      {/* Bootstrap labels on key nodes */}
      <text x={73} y={70} fontFamily="JetBrains Mono, monospace" fontSize="6" fill="#0d6e6e">100/99</text>
      <text x={53} y={140} fontFamily="JetBrains Mono, monospace" fontSize="6" fill="#48463d">94/82</text>
      {/* Scale bar */}
      <line x1={30} x2={75} y1={245} y2={245} stroke="#1a1a1f" strokeWidth="0.8" />
      <line x1={30} x2={30} y1={242} y2={248} stroke="#1a1a1f" strokeWidth="0.8" />
      <line x1={75} x2={75} y1={242} y2={248} stroke="#1a1a1f" strokeWidth="0.8" />
      <text x={52} y={255} textAnchor="middle"
        fontFamily="JetBrains Mono, monospace" fontSize="7" fill="#48463d">0.05 subs/site</text>
    </svg>
  );
}

function ResultsPanel({ runState, openLog }) {
  const ready = runState === 'done';
  const Placeholder = ({ what }) => (
    <div style={{
      height: 260,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 8,
      background: 'repeating-linear-gradient(45deg, #f4f1e8 0 8px, #fafaf7 8px 16px)',
      border: '1px dashed #d8d4c7',
      borderRadius: 4,
      color: '#8a8576',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 11,
    }}>
      <div>{what}</div>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>awaits run</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ResultCard
          title="Principal Component Analysis"
          subtitle="results/pca/strain_pca.pdf"
          ready={ready}
          onOpen={() => openLog('pca')}
        >
          {ready ? <PCAPlot /> : <Placeholder what="PCA scatter" />}
        </ResultCard>
        <ResultCard
          title="Maximum Likelihood Phylogeny"
          subtitle="results/phylogeny/tree/strain_tree.treefile"
          ready={ready}
          onOpen={() => openLog('phylo')}
        >
          {ready ? <PhyloTree /> : <Placeholder what="IQ-TREE cladogram" />}
        </ResultCard>
      </div>
    </div>
  );
}

function ResultCard({ title, subtitle, ready, onOpen, children }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8e4d8',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f0ece0',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: 'Newsreader, serif',
            fontSize: 16,
            color: '#1a1a1f',
            letterSpacing: '-0.01em',
          }}>{title}</div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: '#8a8576',
            marginTop: 2,
          }}>{subtitle}</div>
        </div>
        {ready && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={onOpen} style={iconBtn}>logs</button>
            <button style={iconBtn}>↓ pdf</button>
          </div>
        )}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

const iconBtn = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  padding: '3px 7px',
  background: 'transparent',
  border: '1px solid #d8d4c7',
  borderRadius: 3,
  color: '#48463d',
  cursor: 'pointer',
  textTransform: 'lowercase',
};

Object.assign(window, { ResultsPanel, PCAPlot, PhyloTree });
