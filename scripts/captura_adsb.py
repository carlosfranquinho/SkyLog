#!/usr/bin/env python3
import os
import csv
import json
import subprocess
from datetime import datetime

# Diretórios base
BASE_DIR = os.path.expanduser("~/Projetos/SkyLog/dados")
HOURLY_DIR = os.path.join(BASE_DIR, "horarios")
DAILY_DIR = os.path.join(BASE_DIR, "diarios")
os.makedirs(HOURLY_DIR, exist_ok=True)
os.makedirs(DAILY_DIR, exist_ok=True)

# Executar curl para obter o JSON diretamente
try:
    resultado = subprocess.run(
        ["curl", "-s", "http://localhost:8080/data/aircraft.json"],
        check=True,
        capture_output=True,
        text=True
    )
    data = json.loads(resultado.stdout)
    # O timestamp fornecido pelo dump1090 está em UTC. Convertemos para a
    # hora local para que os ficheiros sejam gravados com a hora correta.
    now = datetime.fromtimestamp(data["now"])
except Exception as e:
    print(f"❌ Erro ao obter dados do dump1090 via curl: {e}")
    exit(1)

# Verificar se há aviões
if "aircraft" not in data or not data["aircraft"]:
    print("⚠️ Nenhum avião detetado neste instante.")
    exit(0)

# Nomes dos ficheiros
data_str = now.strftime("%Y-%m-%d")
hora_str = now.strftime("%H")
hourly_file = os.path.join(HOURLY_DIR, f"{data_str}_{hora_str}.csv")
daily_file = os.path.join(DAILY_DIR, f"{data_str}.csv")

# Campos a gravar
campos = [
    "timestamp", "hex", "flight", "alt_baro", "gs", "track",
    "lat", "lon", "seen", "squawk", "category"
]

def guardar(ficheiro, linha, header):
    existe = os.path.exists(ficheiro)
    with open(ficheiro, "a", newline="") as f:
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
        "category": aviao.get("category")
    }

    guardar(hourly_file, registo, campos)
    guardar(daily_file, registo, campos)
    contagem += 1

print(f"✅ {contagem} aviões gravados às {now.strftime('%H:%M')} (hora local)")
print(f"↪ Ficheiro horário: {hourly_file}")
print(f"↪ Ficheiro diário : {daily_file}")
