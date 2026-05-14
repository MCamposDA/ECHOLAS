"""
ECHOLAS backend — FastAPI server that powers the dashboard.

Endpoints
=========

Dashboard
  GET  /                       → serves the dashboard HTML
  GET  /favicon.ico            → tiny SVG favicon

Files (raw_data + reference)
  GET  /api/files              → {raw, disabled, reference, project}
  POST /api/files/toggle?name= → move file between raw_data/ and
                                 raw_data/_disabled/ (auto-detects direction)

Pipeline
  POST /api/run?resume=false   → start `nextflow run main.nf --mode AUTO`
  GET  /api/log                → stream stdout via Server-Sent Events
  POST /api/stop               → abort the running pipeline

Results
  GET  /api/results/manifest   → grouped directory listing under results/
  GET  /api/results/pca        → {eigenvec, eigenval, path, pdfPath}
  GET  /api/results/tree       → {newick, path}
  GET  /api/results/file?path= → raw file (download or inline view)

All paths returned to the browser are RELATIVE to the project root, so they
work whether the user is running natively or inside the Docker container.
"""

import asyncio
import mimetypes
import os
import shutil
import signal
import subprocess
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, Response, StreamingResponse

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT = Path(os.environ.get("ECHOLAS_PROJECT", "/data")).resolve()
STATIC  = Path(os.environ.get("ECHOLAS_STATIC",  "/echolas/static")).resolve()

RAW_DIR      = PROJECT / "raw_data"
DISABLED_DIR = RAW_DIR / "_disabled"
REF_DIR      = PROJECT / "reference"
RESULTS_DIR  = PROJECT / "results"

# Accepted raw-data extensions
RAW_EXTS = {".fastq.gz", ".fq.gz", ".fastq", ".fq"}

# Accepted reference extensions (the actual genome — not BWA indices)
REF_EXTS = {".fna", ".fasta", ".fa"}

app = FastAPI(title="ECHOLAS")


# ---------------------------------------------------------------------------
# Run state — single global pipeline process (lab-tool scale)
# ---------------------------------------------------------------------------

class RunState:
    proc: "subprocess.Popen | None" = None
    log_buffer: list = []

state = RunState()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _matches_ext(name: str, exts: set) -> bool:
    n = name.lower()
    return any(n.endswith(e) for e in exts)


def _list_dir(d: Path, exts: set) -> list:
    if not d.exists():
        return []
    out = []
    for f in sorted(d.iterdir()):
        if f.is_file() and _matches_ext(f.name, exts):
            out.append({"name": f.name, "size": f.stat().st_size})
    return out


def _safe_under(base: Path, candidate: Path) -> Path:
    """Resolve `candidate` and ensure it sits under `base`. Else raise 400."""
    try:
        full = (base / candidate).resolve()
    except Exception:
        raise HTTPException(400, "invalid path")
    base_resolved = base.resolve()
    try:
        full.relative_to(base_resolved)
    except ValueError:
        raise HTTPException(400, "path escapes project root")
    return full


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return FileResponse(STATIC / "index.html")


@app.get("/logo.png")
def logo():
    """Serve the project logo. Looks in two places:
       1) /echolas/static/logo.png (baked into the image at build time)
       2) <PROJECT>/assets/logo.png (drop-in override from the user's folder)
    The user-folder copy wins so people can rebrand without rebuilding."""
    user_logo = PROJECT / "assets" / "logo.png"
    baked_logo = STATIC / "logo.png"
    for p in (user_logo, baked_logo):
        if p.exists() and p.is_file():
            return FileResponse(p, media_type="image/png")
    raise HTTPException(404, "logo not found")


@app.get("/favicon.ico")
def favicon():
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        '<rect width="32" height="32" fill="#f5ecdd"/>'
        # DNA helix in warm gold
        '<g stroke="#a8794a" stroke-width="1.6" fill="none" stroke-linecap="round">'
        '<path d="M9 4 C 14 9, 14 13, 9 17 C 4 22, 4 25, 9 29"/>'
        '<path d="M16 4 C 11 9, 11 13, 16 17 C 21 22, 21 25, 16 29"/>'
        '</g>'
        # Tree branch in navy
        '<g stroke="#1f3a5f" stroke-width="1.4" fill="none" stroke-linecap="round">'
        '<line x1="18" y1="17" x2="23" y2="17"/>'
        '<line x1="23" y1="11" x2="23" y2="23"/>'
        '<line x1="23" y1="11" x2="28" y2="9"/>'
        '<line x1="23" y1="23" x2="28" y2="25"/>'
        '</g>'
        # Leaf nodes in forest green
        '<circle cx="28" cy="9" r="2" fill="#2d6b4f"/>'
        '<circle cx="28" cy="17" r="2" fill="#2d6b4f"/>'
        '<circle cx="28" cy="25" r="2" fill="#2d6b4f"/>'
        '</svg>'
    )
    return Response(content=svg, media_type="image/svg+xml")


# ---------------------------------------------------------------------------
# /api/files — list raw_data, raw_data/_disabled, and reference
# ---------------------------------------------------------------------------

@app.get("/api/files")
def list_files():
    raw = [f for f in _list_dir(RAW_DIR, RAW_EXTS)]
    # Exclude things inside _disabled from the active list
    disabled_names = {f["name"] for f in _list_dir(DISABLED_DIR, RAW_EXTS)}
    raw = [f for f in raw if f["name"] not in disabled_names]
    disabled = _list_dir(DISABLED_DIR, RAW_EXTS)
    reference = _list_dir(REF_DIR, REF_EXTS)
    return {
        "raw": raw,
        "disabled": disabled,
        "reference": reference,
        "project": str(PROJECT),
    }


@app.post("/api/files/toggle")
def toggle_file(name: str = Query(..., description="File name (no path)")):
    """Move a FASTQ between raw_data/ and raw_data/_disabled/."""
    if "/" in name or "\\" in name or name.startswith("."):
        raise HTTPException(400, "invalid file name")

    DISABLED_DIR.mkdir(parents=True, exist_ok=True)
    active   = RAW_DIR / name
    disabled = DISABLED_DIR / name

    if active.exists() and active.is_file():
        # Move active → disabled
        shutil.move(str(active), str(disabled))
        return {"name": name, "now": "disabled"}
    elif disabled.exists() and disabled.is_file():
        # Move disabled → active
        shutil.move(str(disabled), str(active))
        return {"name": name, "now": "active"}
    else:
        raise HTTPException(404, f"file not found: {name}")


# ---------------------------------------------------------------------------
# /api/run — start the pipeline
# ---------------------------------------------------------------------------

@app.post("/api/run")
def run_pipeline(resume: bool = False):
    if state.proc and state.proc.poll() is None:
        raise HTTPException(409, "Pipeline already running")

    cmd = ["nextflow", "run", "main.nf", "--mode", "AUTO"]
    if resume:
        cmd.append("-resume")

    state.log_buffer = [f"$ {' '.join(cmd)}"]
    state.proc = subprocess.Popen(
        cmd,
        cwd=PROJECT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        preexec_fn=os.setsid,
    )

    return {"started": True, "pid": state.proc.pid, "command": " ".join(cmd)}


# ---------------------------------------------------------------------------
# /api/log — stream stdout via Server-Sent Events
# ---------------------------------------------------------------------------

@app.get("/api/log")
async def stream_log():
    async def gen():
        for line in state.log_buffer:
            yield f"data: {line}\n\n"
        if not state.proc:
            yield "data: [no run in progress]\n\n"
            return
        loop = asyncio.get_event_loop()
        while True:
            line = await loop.run_in_executor(None, state.proc.stdout.readline)
            if not line:
                break
            line = line.rstrip()
            state.log_buffer.append(line)
            yield f"data: {line}\n\n"
        rc = state.proc.wait()
        yield f"data: [exit code: {rc}]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# /api/stop — abort
# ---------------------------------------------------------------------------

@app.post("/api/stop")
def stop():
    if state.proc and state.proc.poll() is None:
        os.killpg(os.getpgid(state.proc.pid), signal.SIGTERM)
        return {"stopped": True}
    return {"stopped": False, "reason": "not running"}


# ---------------------------------------------------------------------------
# /api/results/manifest — grouped directory listing
# ---------------------------------------------------------------------------

# Define the directory groups we surface, in display order. Each entry maps a
# relative-to-results path to a "type" tag and a glob filter (None = all files).
_GROUPS = [
    ("fastqc/raw",                "HTML",   "*.html"),
    ("fastqc/post",               "HTML",   "*.html"),
    ("trimmed",                   "FASTQ",  "**/*.fastq.gz"),
    ("alignments",                "BAM",    "*.bam"),
    ("alignments/statistics",     "TXT",    "*.txt"),
    ("alignments/bam_dedup",      "BAM",    "*.bam"),
    ("gvcf",                      "GVCF",   "*.g.vcf.gz"),
    ("genotyping/joint_vcf",      "VCF",    "*.vcf.gz"),
    ("filtering/snps",            "VCF",    "*.vcf.gz"),
    ("filtering/pca",             "VCF",    "*.vcf.gz"),
    ("filtering/phylo",           "VCF",    "*.vcf.gz"),
    ("filtering/gatk",            "VCF",    "*.vcf.gz"),
    ("filtering/final",           "VCF",    "*.vcf.gz"),
    ("pca/pca_output",            "PCA",    "*"),
    ("phylogeny",                 "FASTA",  "*.fasta"),
    ("phylogeny/tree/phylogeny",  "TREE",   "*"),
]


@app.get("/api/results/manifest")
def results_manifest():
    if not RESULTS_DIR.exists():
        return {"groups": []}

    groups = []
    for rel, kind, pat in _GROUPS:
        d = RESULTS_DIR / rel
        if not d.exists():
            continue
        files = []
        for f in sorted(d.glob(pat)):
            if f.is_file():
                files.append({
                    "path": str(f.relative_to(PROJECT)),
                    "size": f.stat().st_size,
                })
        if not files:
            continue
        groups.append({
            "dir": "results/" + rel,
            "type": kind,
            "count": len(files),
            "size": sum(f["size"] for f in files),
            "files": files,
        })
    return {"groups": groups}


# ---------------------------------------------------------------------------
# /api/results/pca — PCA data for the scatter plot
# ---------------------------------------------------------------------------

@app.get("/api/results/pca")
def results_pca():
    pca_dir = RESULTS_DIR / "pca" / "pca_output"
    eigenvec = pca_dir / "strain.eigenvec"
    eigenval = pca_dir / "strain.eigenval"
    if not eigenvec.exists() or not eigenval.exists():
        raise HTTPException(404, "PCA output not yet available")
    pdfs = list(pca_dir.glob("*.pdf"))
    pdf_rel = str(pdfs[0].relative_to(PROJECT)) if pdfs else None
    return {
        "eigenvec": eigenvec.read_text(),
        "eigenval": eigenval.read_text(),
        "path": str(pca_dir.relative_to(PROJECT)),
        "pdfPath": pdf_rel,
    }


# ---------------------------------------------------------------------------
# /api/results/tree — Newick string for the phylogeny
# ---------------------------------------------------------------------------

@app.get("/api/results/tree")
def results_tree():
    # Look for the canonical IQ-TREE outputs in the right location.
    candidates = [
        RESULTS_DIR / "phylogeny" / "tree" / "phylogeny" / "strain_tree.treefile",
        RESULTS_DIR / "phylogeny" / "tree" / "strain_tree.treefile",
    ]
    tree = next((p for p in candidates if p.exists()), None)
    if not tree:
        # Fall back: any *.treefile under phylogeny/tree
        cand = list((RESULTS_DIR / "phylogeny").rglob("*.treefile"))
        tree = cand[0] if cand else None
    if not tree:
        raise HTTPException(404, "phylogeny treefile not yet available")
    return {
        "newick": tree.read_text().strip(),
        "path": str(tree.relative_to(PROJECT)),
    }


# ---------------------------------------------------------------------------
# /api/results/file — download or view a single file from results/
# ---------------------------------------------------------------------------

@app.get("/api/results/file")
def results_file(path: str = Query(..., description="Path relative to project root, e.g. results/pca/pca_output/strain_PC1_PC2.pdf")):
    full = _safe_under(PROJECT, Path(path))
    if not full.exists() or not full.is_file():
        raise HTTPException(404, "file not found")

    # Choose viewable inline vs download
    mime, _ = mimetypes.guess_type(full.name)
    inline_types = {"application/pdf", "text/html", "text/plain", "image/svg+xml", "image/png", "image/jpeg"}
    if mime in inline_types:
        return FileResponse(full, media_type=mime, filename=full.name,
                             headers={"Content-Disposition": f'inline; filename="{full.name}"'})
    # Default: trigger download
    return FileResponse(full, filename=full.name,
                        media_type=mime or "application/octet-stream",
                        headers={"Content-Disposition": f'attachment; filename="{full.name}"'})
