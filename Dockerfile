# =============================================================================
# ECHOLAS — Dockerfile
# =============================================================================
# This file is the "recipe" Docker uses to build the image.
# Each `RUN` / `COPY` line is a step — Docker caches each step, so rebuilding
# is fast as long as you don't change the earlier ones.
# =============================================================================

# Step 1: Start from a Linux base that already has Miniconda installed.
FROM continuumio/miniconda3:24.7.1-0

LABEL maintainer="ECHOLAS"
LABEL description="Evolutionary Comparison and Hierarchical Organization on Leishmania Analysis"

# Step 2: Install Java (Nextflow requires it) and a few system utilities.
RUN apt-get update && apt-get install -y --no-install-recommends \
        openjdk-17-jre-headless \
        curl \
        bash \
        procps \
        ca-certificates \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# Step 3: Install Nextflow (version 25.04 to match your local setup).
ENV NXF_VERSION=25.04.2
RUN curl -fsSL https://github.com/nextflow-io/nextflow/releases/download/v${NXF_VERSION}/nextflow \
        -o /usr/local/bin/nextflow && \
    chmod +x /usr/local/bin/nextflow

# Step 4: Build ONE consolidated conda environment containing every tool the
# pipeline uses (FastQC, BWA, GATK, IQ-TREE, R, …). This avoids the
# `command not found` errors you saw when Nextflow tries to provision
# per-process envs at runtime.
COPY docker/envs/echolas.yml /tmp/echolas.yml
RUN conda config --set channel_priority strict && \
    conda env create -f /tmp/echolas.yml && \
    conda clean -a -y

# Step 5: Make the `echolas` conda env active for ALL subsequent commands and
# for the running container, so `fastqc`, `bwa`, `gatk`, etc. are on PATH.
ENV PATH=/opt/conda/envs/echolas/bin:$PATH
ENV CONDA_DEFAULT_ENV=echolas

# Step 6: Tell Nextflow NOT to create per-process conda envs — the tools are
# already installed and on PATH. This is the critical switch that makes the
# pipeline pick up the system tools we just baked in.
ENV NXF_CONDA_ENABLED=false

# Step 7: Install the Python web server that talks between dashboard and CLI.
RUN /opt/conda/envs/echolas/bin/pip install --no-cache-dir \
        fastapi==0.115.0 \
        "uvicorn[standard]==0.30.6"

# Step 8: Set up the working directory inside the container.
WORKDIR /echolas

# Step 9: Copy the dashboard, backend, logo, and startup banner into the image.
COPY ECHOLAS-standalone.html /echolas/static/index.html
COPY assets/logo.png         /echolas/static/logo.png
COPY docker/backend.py       /echolas/backend.py
COPY docker/entrypoint.sh    /echolas/entrypoint.sh
RUN chmod +x /echolas/entrypoint.sh

# Step 10: Tell Docker which port the container exposes.
EXPOSE 8080

# Step 11: Run the entrypoint — it prints the friendly banner, then launches
# the web server.
CMD ["/echolas/entrypoint.sh"]
