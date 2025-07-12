from pathlib import Path
import json
import csv
from datetime import datetime
from math import radians, cos, sin, asin, sqrt
from collections import defaultdict

# Coordenadas da estção
ESTACAO_LAT = 39.74759200010467
ESTACAO_LON = -8.936510104648143

# Diretórios relativos ao projeto
BASE_DIR = Path(__file__).resolve().parent.parent
dir_csv = BASE_DIR / "dados" / "horarios"
output_path = BASE_DIR / "site" / "painel.json"
icao_ranges_path = BASE_DIR / "dados" / "icao_ranges.json"
companhias_path = BASE_DIR / "dados" / "companhias.json"
geo_path = BASE_DIR / "dados" / "geo" / "ContinenteConcelhos.geojson"


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
try:
    geo_dados = carregar_json(geo_path)["features"]
except FileNotFoundError:
    geo_dados = []

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

def encontrar_local(lat, lon, features):
    """Devolve o município mais próximo das coordenadas indicadas."""
    melhor = None
    melhor_dist = None
    for feat in features:
        nome = feat.get("properties", {}).get("nome") or feat.get(
            "properties", {}
        ).get("name")
        try:
            flon, flat = feat["geometry"]["coordinates"]
        except Exception:
            continue
        d = haversine(lat, lon, flat, flon)
        if melhor_dist is None or d < melhor_dist:
            melhor_dist = d
            melhor = nome
    return melhor

ficheiros = sorted(dir_csv.glob("*.csv"))
if len(ficheiros) < 2:
    raise FileNotFoundError("Pelo menos dois ficheiros CSV são necessários em dados/horarios")

# Selecionar o penúltimo ficheiro (hora completa anterior)
ultimo_csv = ficheiros[-2]

registos = []
companhias = defaultdict(int)
paises = defaultdict(int)

# Guardar a linha mais completa por voo (hex ou callsign)
melhores_linhas = {}

with ultimo_csv.open(encoding="utf-8") as f:
    leitor = csv.DictReader(f)
    for linha in leitor:
        chamada = linha["flight"].strip()
        hexcode = linha["hex"].strip()
        voo_id = hexcode or chamada
        if not voo_id:
            continue

        # Número de campos não vazios para definir "completo"
        campos_check = [
            "flight", "alt_baro", "gs", "track", "lat", "lon",
            "seen", "squawk", "category"
        ]
        score = sum(1 for c in campos_check if linha.get(c))

        atual = melhores_linhas.get(voo_id)
        if not atual or score > atual["score"]:
            melhores_linhas[voo_id] = {"score": score, "linha": linha}

for info in melhores_linhas.values():
    linha = info["linha"]
    chamada = linha["flight"].strip()
    hexcode = linha["hex"].strip()
    companhia = chamada[:3] if len(chamada) >= 3 else ""
    companhia_nome = companhias_info.get(companhia, {}).get("nome", companhia)
    alt = linha.get("alt_baro", "").strip()
    vel = linha.get("gs", "").strip()
    hora = linha["timestamp"][:16]

    local = None
    try:
        lat = float(linha["lat"])
        lon = float(linha["lon"])
        dist = haversine(ESTACAO_LAT, ESTACAO_LON, lat, lon)
        local = encontrar_local(lat, lon, geo_dados) if geo_dados else None
    except Exception:
        dist = ""

    if not alt and not vel and not dist:
        continue

    pais, bandeira = hex_para_info_pais(hexcode, icao_ranges)

    if companhia:
        companhias[companhia] += 1
    if pais:
        paises[(pais, bandeira)] += 1

    registos.append({
        "hex": hexcode,
        "chamada": chamada,
        "cia": companhia_nome,
        "pais": pais,
        "local": local,
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
