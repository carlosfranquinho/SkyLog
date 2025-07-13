#!/usr/bin/env python3
import os
import csv
import json
import requests
from datetime import datetime
from pathlib import Path


def main() -> None:
    # Diretórios base
    root_dir = Path(os.environ.get("BASE_DIR", Path(__file__).resolve().parent.parent))
    base_dir = root_dir / "dados"
    hourly_dir = base_dir / "horarios"
    daily_dir = base_dir / "diarios"
    hourly_dir.mkdir(parents=True, exist_ok=True)
    daily_dir.mkdir(parents=True, exist_ok=True)

    # Obter o JSON diretamente via requests
    url = os.environ.get(
        "DUMP1090_URL",
        "http://localhost:8080/data/aircraft.json",
    )
    print(f"ℹ️ A obter dados de {url}")
    try:
        session = requests.Session()
        # Ignore proxy configuration from the environment so the request always
        # targets the local dump1090 instance directly.
        session.trust_env = False
        resposta = session.get(
            url,
            timeout=5,
            headers={"User-Agent": "SkyLog/1.0"},
        )
        resposta.raise_for_status()
        data = resposta.json()
        # O timestamp fornecido pelo dump1090 está em UTC. Convertemos para a
        # hora local para que os ficheiros sejam gravados com a hora correta.
        now = datetime.fromtimestamp(data["now"])
    except Exception as e:
        print(f"❌ Erro ao obter dados do dump1090: {e}")
        return

    # Verificar se há aviões
    if "aircraft" not in data or not data["aircraft"]:
        print("⚠️ Nenhum avião detetado neste instante.")
        return

    # Nomes dos ficheiros
    data_str = now.strftime("%Y-%m-%d")
    hora_str = now.strftime("%H")
    hourly_file = hourly_dir / f"{data_str}_{hora_str}.csv"
    daily_file = daily_dir / f"{data_str}.csv"

    # Campos a gravar
    campos = [
        "timestamp",
        "hex",
        "flight",
        "alt_baro",
        "gs",
        "track",
        "lat",
        "lon",
        "seen",
        "squawk",
        "category",
    ]

    def guardar(ficheiro: Path, linha: dict, header: list[str]) -> None:
        existe = ficheiro.exists()
        with ficheiro.open("a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=header)
            if not existe:
                writer.writeheader()
            writer.writerow(linha)

    # Guardar registos
    contagem = 0
    for aviao in data.get("aircraft", []):
        if "hex" not in aviao:
            continue

        registo = {
            "timestamp": now.isoformat(),
            "hex": aviao.get("hex"),
            "flight": aviao.get("flight", "").strip(),
            "alt_baro": aviao.get("alt_baro"),
            "gs": aviao.get("gs"),
            "track": aviao.get("track"),
            "lat": aviao.get("lat"),
            "lon": aviao.get("lon"),
            "seen": aviao.get("seen"),
            "squawk": aviao.get("squawk"),
            "category": aviao.get("category"),
        }

        guardar(hourly_file, registo, campos)
        guardar(daily_file, registo, campos)
        contagem += 1

    print(
        f"✅ {contagem} aviões gravados às {now.strftime('%H:%M')} (hora local)"
    )
    print(f"↪ Ficheiro horário: {hourly_file}")
    print(f"↪ Ficheiro diário : {daily_file}")


if __name__ == "__main__":
    main()
