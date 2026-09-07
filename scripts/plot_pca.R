#!/usr/bin/env Rscript

# ===============================
# PCA plot – ggplot2
# ===============================

.libPaths(c(Sys.getenv("R_LIBS_USER"), .libPaths()))

library(ggplot2)
library(readr)
library(dplyr)

# argumentos
args <- commandArgs(trailingOnly = TRUE)
eigenvec <- args[1]
eigenval <- args[2]
outpdf   <- args[3]

# ler eigenvalues (variância explicada)
eigval <- scan(eigenval)
pc1_var <- round(eigval[1] / sum(eigval) * 100, 1)
pc2_var <- round(eigval[2] / sum(eigval) * 100, 1)

# ler PCA
pca <- read_table(
  eigenvec,
  col_names = c("FID","IID","PC1","PC2","PC3","PC4","PC5","PC6","PC7","PC8","PC9","PC10")
)

# plot
p <- ggplot(pca, aes(x = PC1, y = PC2, label = IID)) +
  geom_point(size = 3) +
  geom_text(vjust = -0.8, size = 3.5) +
  theme_bw() +
  labs(
    title = "PCA of E.coli strains",
    x = paste0("PC1 (", pc1_var, "%)"),
    y = paste0("PC2 (", pc2_var, "%)")
  )

ggsave(outpdf, p, width = 7, height = 5)
