#!/usr/bin/env python3
from pathlib import Path
import os
import csv
import json


def main() -> None:
    base_dir = Path(
        os.environ.get("BASE_DIR", Path(__file__).resolve().parent.parent)
    )
    csv_dir = base_dir / "dados" / "horarios"
    saida = base_dir / "dados" / "companhias.json"

    # Carregar mapeamentos existentes, se houver
    existentes = {}
    if saida.exists():
        try:
            with saida.open(encoding="utf-8") as f:
                existentes = json.load(f)
        except Exception:
            pass

    codigos = set()
    for ficheiro in csv_dir.glob("*.csv"):
        with ficheiro.open(encoding="utf-8") as f:
            leitor = csv.DictReader(f)
            for linha in leitor:
                voo = linha.get("flight", "").strip()
                if len(voo) >= 3 and voo[:3].isalpha():
                    codigo = voo[:3].upper()
                    codigos.add(codigo)

    # Combinar com os mapeamentos existentes e manter nomes conhecidos
    resultado = {}
    todos = codigos | set(existentes.keys())
    for codigo in sorted(todos):
        nome = existentes.get(codigo, {}).get("nome", codigo)
        resultado[codigo] = {"nome": nome}

    saida.write_text(json.dumps(resultado, indent=2, ensure_ascii=False))
    print(f"Ficheiro atualizado: {saida}")


if __name__ == "__main__":
    main()
