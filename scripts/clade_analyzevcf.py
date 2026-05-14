import subprocess
import os

print("\n=== Clade VCF Generator ===\n")

vcf = input("Path do VCF anotado (.vcf.gz): ").strip()

if not os.path.exists(vcf):
    print("ERRO: VCF não encontrado.")
    exit()

outdir = input("Diretório de saída (ex: clade_vcfs): ").strip()
os.makedirs(outdir, exist_ok=True)

n_groups = int(input("Quantos grupos/clados deseja criar? "))

groups = {}

for i in range(n_groups):
    print(f"\n--- Grupo {i+1} ---")
    name = input("Nome do grupo: ").strip()

    samples = input(
        "Amostras do grupo (separadas por vírgula): "
    ).replace(" ", "").split(",")

    groups[name] = samples

print("\nCriando arquivos...\n")

for group, samples in groups.items():

    txt_path = os.path.join(outdir, f"{group}.txt")

    with open(txt_path, "w") as f:
        for s in samples:
            f.write(s + "\n")

    out_vcf = os.path.join(outdir, f"{group}.ann.vcf.gz")

    cmd_view = [
        "bcftools", "view",
        "-S", txt_path,
        "-Oz",
        "-o", out_vcf,
        vcf
    ]

    cmd_index = [
        "bcftools", "index",
        out_vcf
    ]

    print(f"Gerando VCF do grupo: {group}")
    subprocess.run(cmd_view)
    subprocess.run(cmd_index)

print("\n✅ Todos os grupos foram gerados com sucesso.")

