from pathlib import Path
import json
import csv
from datetime import datetime
from math import radians, cos, sin, asin, sqrt
from collections import defaultdict

# Coordenadas da estção
ESTACAO_LAT = 39.74759200010467
ESTACAO_LON = -8.936510104648143

# Diretórios
dir_csv = Path("../dados/horarios")
output_path = Path("../site/painel.json")
icao_ranges_path = Path("../dados/icao_ranges.json")
companhias_path = Path("../dados/companhias.json")

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return round(R * c, 1)

def carregar_json(caminho):
    with caminho.open(encoding="utf-8") as f:
        return json.load(f)

icao_ranges = carregar_json(icao_ranges_path)
companhias_info = carregar_json(companhias_path)

def hex_para_info_pais(hexcode, ranges):
    try:
        valor = int(hexcode, 16)
        for entrada in ranges:
            inicio = int(entrada["start"], 16)
            fim = int(entrada["end"], 16)
            if inicio <= valor <= fim:
                return entrada.get("country", "Desconhecido"), entrada.get("bandeira", "")
    except:
        pass
    return "Desconhecido", ""

ficheiros = sorted(dir_csv.glob("*.csv"))
if len(ficheiros) < 2:
    raise FileNotFoundError("Pelo menos dois ficheiros CSV são necessários em dados/horarios")

# Selecionar o penúltimo ficheiro (hora completa anterior)
ultimo_csv = ficheiros[-2]

registos = []
companhias = defaultdict(int)
paises = defaultdict(int)
voos_vistos = set()

with ultimo_csv.open(encoding="utf-8") as f:
    leitor = csv.DictReader(f)
    for linha in leitor:
        chamada = linha["flight"].strip()
        hexcode = linha["hex"].strip()
        companhia = chamada[:3] if len(chamada) >= 3 else ""
        alt = linha.get("alt_baro", "").strip()
        vel = linha.get("gs", "").strip()
        hora = linha["timestamp"][:16]

        try:
            lat = float(linha["lat"])
            lon = float(linha["lon"])
            dist = haversine(ESTACAO_LAT, ESTACAO_LON, lat, lon)
        except:
            dist = ""

        # Ignorar se não tem dados relevantes
        if not alt and not vel and not dist:
            continue

        # Ignorar voos repetidos (único por hexcode ou chamada)
        voo_id = hexcode or chamada
        if voo_id in voos_vistos:
            continue
        voos_vistos.add(voo_id)

        pais, bandeira = hex_para_info_pais(hexcode, icao_ranges)

        if companhia:
            companhias[companhia] += 1
        if pais:
            paises[(pais, bandeira)] += 1

        registos.append({
            "hex": hexcode,
            "chamada": chamada,
            "cia": companhia,
            "pais": pais,
            "alt": alt,
            "vel": vel,
            "dist": dist,
            "hora": hora
        })

ultima_hora = sorted(registos, key=lambda x: x["hora"], reverse=True)

top_paises = sorted(paises.items(), key=lambda x: x[1], reverse=True)[:10]
top_companhias = sorted(companhias.items(), key=lambda x: x[1], reverse=True)[:10]

top_paises_legiveis = [
    {"pais": chave[0], "bandeira": chave[1], "total": total}
    for chave, total in top_paises
]
top_companhias_legiveis = [
    {"cia": companhias_info.get(c, {}).get("nome", c), "total": t}
    for c, t in top_companhias
]

saida = {
    "ultima_hora": ultima_hora,
    "top_paises": top_paises_legiveis,
    "top_companhias": top_companhias_legiveis,
    "rotas": []
}

output_path.parent.mkdir(parents=True, exist_ok=True)
with output_path.open("w", encoding="utf-8") as f:
    json.dump(saida, f, ensure_ascii=False, indent=2)

print(f"Ficheiro gerado: {output_path.name}")
