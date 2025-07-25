import os
import json
import shutil
from pathlib import Path
import sys
import os

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

import scripts.preparar_site as preparar_site
import scripts.gerar_resumo_avioes as gerar_resumo_avioes


def setup_preparar_site_data(tmp_path: Path) -> Path:
    repo = Path(__file__).resolve().parents[1]
    dados_dir = tmp_path / "dados" / "horarios"
    dados_dir.mkdir(parents=True)
    for fname in ["2025-07-12_00.csv", "2025-07-12_01.csv"]:
        shutil.copy(repo / "dados" / "horarios" / fname, dados_dir / fname)
    shutil.copy(repo / "dados" / "icao_ranges.json", tmp_path / "dados" / "icao_ranges.json")
    shutil.copy(repo / "dados" / "companhias.json", tmp_path / "dados" / "companhias.json")
    return tmp_path


def test_preparar_site_generates_keys(tmp_path):
    base_dir = setup_preparar_site_data(tmp_path)
    os.environ["BASE_DIR"] = str(base_dir)
    preparar_site.main()
    arquivos = list((base_dir / "docs" / "arquivo").glob("*.json"))
    assert len(arquivos) == 2
    painel_path = next(p for p in arquivos if p.name != "ultima.json")
    data = json.loads(painel_path.read_text())
    for key in ["ultima_hora", "top_paises", "top_companhias", "rotas"]:
        assert key in data


def test_preparar_site_uses_route_cache(tmp_path):
    base_dir = setup_preparar_site_data(tmp_path)
    cache_file = base_dir / "dados" / "rotas.json"
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(
        json.dumps({"WZZ8744": {"origem": "X", "destino": "Y"}}, ensure_ascii=False, indent=2)
    )
    os.environ["BASE_DIR"] = str(base_dir)
    preparar_site.main()
    arquivos = list((base_dir / "docs" / "arquivo").glob("*.json"))
    assert len(arquivos) == 2
    painel_path = next(p for p in arquivos if p.name != "ultima.json")
    data = json.loads(painel_path.read_text())
    assert any(
        r.get("origem") == "X" and r.get("destino") == "Y" and r.get("chamada") == "WZZ8744"
        for r in data.get("ultima_hora", [])
    )


def setup_diarios_data(tmp_path: Path) -> Path:
    repo = Path(__file__).resolve().parents[1]
    diarios_dir = tmp_path / "dados" / "diarios"
    diarios_dir.mkdir(parents=True)
    shutil.copy(repo / "dados" / "diarios" / "2025-07-11.csv", diarios_dir / "2025-07-11.csv")
    return tmp_path


def test_gerar_resumo_avioes_keys(tmp_path):
    base_dir = setup_diarios_data(tmp_path)
    os.environ["BASE_DIR"] = str(base_dir)
    gerar_resumo_avioes.main()
    resumo_path = base_dir / "resumos" / "avioes.json"
    assert resumo_path.exists()
    data = json.loads(resumo_path.read_text())
    first = next(iter(data.values()))
    for key in ["count", "first_seen", "last_seen", "flights"]:
        assert key in first
