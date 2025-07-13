#!/usr/bin/env python3
import os
import csv
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict


def main() -> None:
    # Caminhos
    base_dir = Path(os.environ.get("BASE_DIR", Path(__file__).resolve().parent.parent))
    diario_dir = base_dir / "dados" / "diarios"
    resumos_dir = base_dir / "resumos"
    resumos_dir.mkdir(parents=True, exist_ok=True)

    # Dicionário para guardar dados agregados
    avioes = defaultdict(
        lambda: {
            "count": 0,
            "first_seen": None,
            "last_seen": None,
            "flights": set(),
        }
    )

    # Processar todos os ficheiros CSV diários
    for csv_file in sorted(diario_dir.glob("*.csv")):
        with open(csv_file, newline="") as f:
            reader = csv.DictReader(f)
            for linha in reader:
                hex_code = linha["hex"]
                timestamp = linha["timestamp"]
                flight = linha.get("flight", "").strip()

                try:
                    ts = datetime.fromisoformat(timestamp)
                except Exception:
                    continue

                entry = avioes[hex_code]
                entry["count"] += 1
                if flight:
                    entry["flights"].add(flight)

                if not entry["first_seen"] or ts < entry["first_seen"]:
                    entry["first_seen"] = ts
                if not entry["last_seen"] or ts > entry["last_seen"]:
                    entry["last_seen"] = ts

    # Converter para formato pronto a exportar
    avioes_json = {
        hex_code: {
            "count": data["count"],
            "first_seen": data["first_seen"].isoformat(),
            "last_seen": data["last_seen"].isoformat(),
            "flights": sorted(list(data["flights"])),
        }
        for hex_code, data in avioes.items()
    }

    # Guardar para ficheiro JSON
    output_file = resumos_dir / "avioes.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(avioes_json, f, ensure_ascii=False, indent=2)

    print(f"✅ Resumo gravado em: {output_file}")
    print(f"✈️ Aviões detetados: {len(avioes_json)}")


if __name__ == "__main__":
    main()
