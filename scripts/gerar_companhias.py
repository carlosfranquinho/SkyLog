#!/usr/bin/env python3
from pathlib import Path
import os
import csv
import json
from collections import Counter

def main() -> None:
    base_dir = Path(os.environ.get("BASE_DIR", Path(__file__).resolve().parent.parent))
    csv_dir = base_dir / "dados" / "horarios"
    saida = base_dir / "dados" / "companhias.json"

    companhias = Counter()

    for ficheiro in csv_dir.glob("*.csv"):
        with ficheiro.open(encoding="utf-8") as f:
            leitor = csv.DictReader(f)
            for linha in leitor:
                voo = linha.get("flight", "").strip()
                if len(voo) >= 3 and voo[:3].isalpha():
                    codigo = voo[:3].upper()
                    companhias[codigo] += 1

    # Ordenar alfabeticamente os códigos
    resultado = {codigo: {"nome": codigo} for codigo in sorted(companhias)}

    saida.write_text(json.dumps(resultado, indent=2, ensure_ascii=False))
    print(f"Ficheiro gerado: {saida}")


if __name__ == "__main__":
    main()
