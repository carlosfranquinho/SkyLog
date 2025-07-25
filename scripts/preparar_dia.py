#!/usr/bin/env python3
from pathlib import Path
import os
import json
import csv
import urllib.request
import urllib.parse
from math import radians, cos, sin, asin, sqrt
from collections import defaultdict
from typing import Any, Dict

# Coordenadas da estação
ESTACAO_LAT = 39.74759200010467
ESTACAO_LON = -8.936510104648143


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return round(R * c, 1)


def carregar_json(caminho: Path):
    with caminho.open(encoding="utf-8") as f:
        return json.load(f)


def carregar_rotas(caminho: Path) -> Dict[str, Dict[str, Any]]:
    """Carrega o cache de rotas do disco, se existir."""
    if not caminho.exists():
        return {}
    try:
        with caminho.open(encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}


def gravar_rotas(caminho: Path, rotas: Dict[str, Dict[str, Any]]) -> None:
    """Grava o cache de rotas para ficheiro."""
    try:
        caminho.parent.mkdir(parents=True, exist_ok=True)
        with caminho.open("w", encoding="utf-8") as f:
            json.dump(rotas, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def hex_para_info_pais(hexcode: str, ranges: list[dict]):
    try:
        valor = int(hexcode, 16)
        for entrada in ranges:
            inicio = int(entrada["start"], 16)
            fim = int(entrada["end"], 16)
            if inicio <= valor <= fim:
                return (
                    entrada.get("country", "Desconhecido"),
                    entrada.get("bandeira", ""),
                )
    except Exception:
        pass
    return "Desconhecido", ""


def encontrar_local(lat: float, lon: float, features: list[dict]):
    """Devolve o município mais próximo das coordenadas indicadas."""
    melhor = None
    melhor_dist = None
    for feat in features:
        nome = feat.get("properties", {}).get("nome") or feat.get("properties", {}).get(
            "name"
        )
        try:
            flon, flat = feat["geometry"]["coordinates"]
        except Exception:
            continue
        d = haversine(lat, lon, flat, flon)
        if melhor_dist is None or d < melhor_dist:
            melhor_dist = d
            melhor = nome
    return melhor


def _obter_nome_aeroporto(icao: str) -> str | None:
    """Devolve o nome do aeroporto a partir do código ICAO."""
    try:
        url = "https://opensky-network.org/api/airports?icao=" + urllib.parse.quote(
            icao
        )
        with urllib.request.urlopen(url, timeout=10) as resp:
            dados = json.loads(resp.read().decode())
        return dados.get("name")
    except Exception:
        return None


def _obter_rota_opensky(callsign: str) -> tuple[str | None, str | None]:
    """Tenta obter a rota usando a API do OpenSky."""
    url = "https://opensky-network.org/api/routes?callsign=" + urllib.parse.quote(
        callsign
    )
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            dados = json.loads(resp.read().decode())
        rota = dados.get("route")
        if rota and len(rota) >= 2:
            origem = _obter_nome_aeroporto(rota[0])
            destino = _obter_nome_aeroporto(rota[-1])
            return origem, destino
    except Exception:
        pass
    return None, None


def _obter_rota_adsb(
    callsign: str, lat: float, lon: float
) -> tuple[str | None, str | None]:
    """Tenta obter a rota usando a API do adsb.im.

    Sempre que possível devolve "Cidade, PAÍS" para os aeroportos de origem
    e destino.
    """
    url = "https://adsb.im/api/0/routeset"
    payload = {
        "planes": [
            {
                "callsign": callsign,
                "lat": lat,
                "lng": lon,
            }
        ]
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            dados = json.loads(resp.read().decode())
        if isinstance(dados, list) and dados:
            info = dados[0]
            airports = info.get("_airports")
            if airports and len(airports) >= 2:

                def fmt(ap):
                    if not isinstance(ap, dict):
                        return None
                    cidade = ap.get("location")
                    pais = ap.get("countryiso2") or ap.get("country")
                    return f"{cidade}, {pais}" if cidade and pais else None

                origem = fmt(airports[0])
                destino = fmt(airports[-1])
                if origem or destino:
                    return origem, destino

            codes = info.get("airport_codes")
            if codes and "-" in codes:
                origem_icao, destino_icao = codes.split("-", 1)
                origem = _obter_nome_aeroporto(origem_icao)
                destino = _obter_nome_aeroporto(destino_icao)
                return origem, destino

    except Exception:
        pass
    return None, None


def obter_rota(
    callsign: str, lat: float | None, lon: float | None
) -> tuple[str | None, str | None]:
    """Obtém a rota de um voo usando adsb.im com fallback no OpenSky."""
    origem = destino = None
    if lat is not None and lon is not None:
        origem, destino = _obter_rota_adsb(callsign, lat, lon)
    if origem is None or destino is None:
        alt_origem, alt_destino = _obter_rota_opensky(callsign)
        origem = origem or alt_origem
        destino = destino or alt_destino
    return origem, destino


def main() -> None:
    base_dir = Path(os.environ.get("BASE_DIR", Path(__file__).resolve().parent.parent))
    dir_csv = base_dir / "dados" / "diarios"
    icao_ranges_path = base_dir / "dados" / "icao_ranges.json"
    companhias_path = base_dir / "dados" / "companhias.json"
    geo_path = base_dir / "dados" / "geo" / "ContinenteConcelhos.geojson"

    icao_ranges = carregar_json(icao_ranges_path)
    companhias_info = carregar_json(companhias_path)
    rotas_cache_path = base_dir / "dados" / "rotas.json"
    rotas_persistidas = carregar_rotas(rotas_cache_path)
    rotas_alteradas = False
    try:
        geo_dados = carregar_json(geo_path)["features"]
    except FileNotFoundError:
        geo_dados = []

    ficheiros = sorted(dir_csv.glob("*.csv"))
    if len(ficheiros) < 2:
        raise FileNotFoundError(
            "Pelo menos dois ficheiros CSV são necessários em dados/diarios"
        )

    ultimo_csv = ficheiros[-2]

    registos = []
    companhias = defaultdict(int)
    paises = defaultdict(int)
    origens = defaultdict(int)
    destinos = defaultdict(int)
    rotas_raw = {}
    melhores_linhas = {}
    rota_cache = {}

    with ultimo_csv.open(encoding="utf-8") as f:
        leitor = csv.DictReader(f)
        for linha in leitor:
            chamada = linha["flight"].strip()
            hexcode = linha["hex"].strip()
            voo_id = hexcode or chamada
            if not voo_id:
                continue

            campos_check = [
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
            score = sum(1 for c in campos_check if linha.get(c))

            atual = melhores_linhas.get(voo_id)
            if not atual or score > atual["score"]:
                melhores_linhas[voo_id] = {"score": score, "linha": linha}

            lat = linha.get("lat", "").strip()
            lon = linha.get("lon", "").strip()
            if lat and lon:
                try:
                    latf = float(lat)
                    lonf = float(lon)
                except ValueError:
                    continue
                info = rotas_raw.get(voo_id)
                if not info:
                    rotas_raw[voo_id] = {
                        "de": [latf, lonf],
                        "para": [latf, lonf],
                    }
                else:
                    info["para"] = [latf, lonf]

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

        origem = destino = None
        if chamada:
            info_persistida = rotas_persistidas.get(chamada)
            if info_persistida:
                origem = info_persistida.get("origem")
                destino = info_persistida.get("destino")

            if origem is None or destino is None:
                rota = rota_cache.get(chamada)
                if rota is None:
                    rota_cache[chamada] = obter_rota(chamada, lat, lon)
                nova_origem, nova_destino = rota_cache.get(chamada, (None, None))
                origem = origem or nova_origem
                destino = destino or nova_destino

            if chamada not in rotas_persistidas and (origem or destino):
                rotas_persistidas[chamada] = {
                    "origem": origem,
                    "destino": destino,
                }
                rotas_alteradas = True
            elif info_persistida and (
                origem != info_persistida.get("origem")
                or destino != info_persistida.get("destino")
            ):
                rotas_persistidas[chamada] = {
                    "origem": origem,
                    "destino": destino,
                }
                rotas_alteradas = True

        if origem:
            origens[origem] += 1
        if destino:
            destinos[destino] += 1
        if companhia:
            companhias[companhia] += 1
        if pais:
            paises[(pais, bandeira)] += 1

        registos.append(
            {
                "hex": hexcode,
                "chamada": chamada,
                "cia": companhia_nome,
                "pais": pais,
                "bandeira": bandeira,
                "local": local,
                "origem": origem,
                "destino": destino,
                "alt": alt,
                "vel": vel,
                "dist": dist,
                "hora": hora,
            }
        )

    voos_dia = sorted(registos, key=lambda x: x["hora"], reverse=True)

    top_paises = sorted(paises.items(), key=lambda x: x[1], reverse=True)[:10]
    top_companhias = sorted(companhias.items(), key=lambda x: x[1], reverse=True)[:10]
    top_origens = sorted(origens.items(), key=lambda x: x[1], reverse=True)[:20]
    top_destinos = sorted(destinos.items(), key=lambda x: x[1], reverse=True)[:20]

    top_paises_legiveis = [
        {"pais": chave[0], "bandeira": chave[1], "total": total}
        for chave, total in top_paises
    ]
    top_companhias_legiveis = [
        {"cia": companhias_info.get(c, {}).get("nome", c), "total": t}
        for c, t in top_companhias
    ]
    top_origens_legiveis = [{"origem": o, "total": t} for o, t in top_origens]
    top_destinos_legiveis = [
        {"destino": d, "total": t} for d, t in top_destinos
    ]

    rotas = []
    for reg in registos:
        vid = reg["hex"] or reg["chamada"]
        pos = rotas_raw.get(vid)
        if not pos:
            continue
        rota = {
            "hex": reg["hex"],
            "chamada": reg["chamada"],
            "de": pos.get("de"),
            "para": pos.get("para"),
        }
        alt = reg.get("alt")
        if alt:
            rota["alt"] = alt
        rotas.append(rota)

    saida = {
        "voos_dia": voos_dia,
        "top_paises": top_paises_legiveis,
        "top_companhias": top_companhias_legiveis,
        "top_origens": top_origens_legiveis,
        "top_destinos": top_destinos_legiveis,
        "rotas": rotas,
    }

    dia_label = voos_dia[0]["hora"][:10]
    output_dir = base_dir / "docs" / "arquivo"
    output_path = output_dir / f"{dia_label}.json"
    output_dir.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=2)

    latest_path = output_dir / "ultimo-dia.json"
    with latest_path.open("w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=2)

    if rotas_alteradas:
        gravar_rotas(rotas_cache_path, rotas_persistidas)

    print(f"Ficheiro gerado: {output_path.name}")


if __name__ == "__main__":
    main()
