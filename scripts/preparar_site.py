from pathlib import Path
import json
from datetime import datetime, timezone
from collections import defaultdict

# Caminhos
input_path = Path("../resumos/avioes.json")
output_path = Path("../site/painel.json")

# Mapas auxiliares
iso_paises = {
    "34": "🇪🇸 Espanha",
    "47": "🇭🇺 Hungria",
    "4C": "🇮🇹 Itália",
    "45": "🇫🇷 França",
    "44": "🇬🇧 Reino Unido",
    "3C": "🇩🇪 Alemanha",
    "3D": "🇩🇪 Alemanha",
    "00": "🌍 Desconhecido"
}

cias_legiveis = {
    "IBE": "Iberia",
    "WZZ": "Wizz Air",
    "AEA": "Air Europa",
    "RYR": "Ryanair",
    "TAP": "TAP Air Portugal",
    "AFR": "Air France",
    "BAW": "British Airways"
}

# Lê o ficheiro original
with input_path.open("r", encoding="utf-8") as f:
    dados = json.load(f)

# Hora atual (UTC)
agora = datetime.now(timezone.utc)

# ----------------------------
# Preparar Top 10 por vezes
# ----------------------------
avioes_ordenados = sorted(
    dados.items(), key=lambda x: x[1]["count"], reverse=True
)[:10]

top_10 = []
companhias = defaultdict(int)
paises = defaultdict(int)

for hexcode, info in dados.items():
    chamada = info["flights"][0] if info["flights"] else ""
    companhia = chamada[:3] if len(chamada) >= 3 else ""
    pais = hexcode[:2].upper()

    if companhia:
        companhias[companhia] += info["count"]
    if pais:
        paises[pais] += info["count"]

for hexcode, info in avioes_ordenados:
    top_10.append({
        "hex": hexcode,
        "vezes": info["count"],
        "primeira": datetime.fromisoformat(info["first_seen"]).strftime("%Y-%m-%d %H:%M"),
        "ultima": datetime.fromisoformat(info["last_seen"]).strftime("%Y-%m-%d %H:%M")
    })

# ----------------------------
# Última hora
# ----------------------------
recentes = []
for hexcode, info in dados.items():
    chamada = info["flights"][0] if info["flights"] else ""
    try:
        dt_last = datetime.fromisoformat(info["last_seen"])
        if dt_last.tzinfo is None:
            dt_last = dt_last.replace(tzinfo=timezone.utc)
    except ValueError:
        continue

    if (agora - dt_last).total_seconds() <= 3600:
        recentes.append({
            "hex": hexcode,
            "chamada": chamada,
            "alt": "",
            "vel": "",
            "dist": "",
            "hora": dt_last.strftime("%Y-%m-%d %H:%M")
        })

recentes = sorted(recentes, key=lambda x: x["hora"], reverse=True)

# ----------------------------
# Top companhias e países
# ----------------------------
top_companhias = sorted(companhias.items(), key=lambda x: x[1], reverse=True)[:10]
top_paises = sorted(paises.items(), key=lambda x: x[1], reverse=True)[:10]

top_cias_formatado = [{
    "cia": cias_legiveis.get(c, c),
    "total": t
} for c, t in top_companhias]

top_paises_formatado = [{
    "pais": iso_paises.get(p, p),
    "total": t
} for p, t in top_paises]

# ----------------------------
# Estrutura final
# ----------------------------
saida = {
    "ultima_hora": recentes,
    "top_paises": top_paises_formatado,
    "top_companhias": top_cias_formatado,
    "rotas": []
}

# Guardar
output_path.parent.mkdir(parents=True, exist_ok=True)
with output_path.open("w", encoding="utf-8") as f:
    json.dump(saida, f, ensure_ascii=False, indent=2)

print(f"✅ Ficheiro {output_path.name} criado com sucesso.")
