# SkyLog

SkyLog collects ADS-B data from a local `dump1090` instance and builds a small
web panel showing the latest detections. The raw CSV logs are kept under the
`dados/` directory and the static website is served from `docs/`.

## Requirements

- Python 3.8 or newer
- `curl` available in the system PATH
- A running `dump1090` server reachable at `http://localhost:8080` (or set
  `DUMP1090_URL` to a custom endpoint)

- Install Python dependencies with `pip install -r requirements.txt`

## Directory layout

- `dados/horarios/` – hourly CSV captures
- `dados/diarios/` – daily CSV aggregates
- `docs/` – static website (HTML, JS, CSS and generated JSON files)
- `resumos/` – JSON summaries of aircraft seen
- `scripts/` – helper scripts used to collect and process the data

Scripts look for a variable called `BASE_DIR` which defaults to the repository root. You can override it by exporting `BASE_DIR` before running them.

## Running the scripts

### Running scripts outside the repository
When executing a script from another directory (for instance from a cron job),
export `BASE_DIR` with the absolute path to this repository so all paths resolve
correctly.

```bash
export BASE_DIR=/path/to/SkyLog
python3 /path/to/SkyLog/scripts/captura_adsb.py
```

### captura_adsb.py
Fetches JSON data from `dump1090` and writes hourly and daily CSV files.
Run:

```bash
python3 scripts/captura_adsb.py
```
To store the logs in another location, set `BASE_DIR` when executing the script:

```bash
BASE_DIR=/path/to/dir python3 scripts/captura_adsb.py
```
This command is run every minute via cron to capture new aircraft data.

The script uses `curl` to fetch the JSON data. You can override the default URL
with the `DUMP1090_URL` environment variable:

```python
root_dir = Path(os.environ.get("BASE_DIR", Path(__file__).resolve().parent.parent))
base_dir = root_dir / "dados"
HOURLY_DIR = base_dir / "horarios"
DAILY_DIR  = base_dir / "diarios"
url = os.environ.get("DUMP1090_URL", "http://localhost:8080/data/aircraft.json")
resultado = subprocess.run(
    ["curl", "-sS", "--fail", "--noproxy", "*", url],
    check=True, capture_output=True, text=True,
)
data = json.loads(resultado.stdout)
```

### gerar_companhias.py
Parses the hourly CSV files and builds `dados/companhias.json` with a simple
mapping of callsign prefixes to airline names.

```bash
python3 scripts/gerar_companhias.py

```

### gerar_resumo_avioes.py
Aggregates all daily CSV logs and stores a summary in
`resumos/avioes.json`.

```bash
python3 scripts/gerar_resumo_avioes.py
```

### preparar_site.py
Processes the latest hourly CSV together with auxiliary data to produce the
JSON files used by the web panel. Each run generates a file inside
`docs/arquivo/` named `YYYY-MM-DD_HH.json` for the captured hour and also
updates `docs/arquivo/ultima.json` with the same contents.

The script queries [adsb.im](https://adsb.im/api/0/routeset) for route
information and, if that fails, falls back to the OpenSky API to resolve the
departure and destination cities.

```bash
python3 scripts/preparar_site.py
```

The relevant paths can be seen at the top of the script:
```python
base_dir = Path(os.environ.get("BASE_DIR", Path(__file__).resolve().parent.parent))
output_dir = base_dir / "docs" / "arquivo"
```

The files are written at the end of the run:

```python
hora_label = ultima_hora[0]["hora"][:13].replace("T", "_")
output_path = output_dir / f"{hora_label}.json"
with output_path.open("w", encoding="utf-8") as f:
    json.dump(saida, f, ensure_ascii=False, indent=2)
with (output_dir / "ultima.json").open("w", encoding="utf-8") as f:
    json.dump(saida, f, ensure_ascii=False, indent=2)
print(f"Ficheiros gerados: {output_path.name} e ultima.json")
```

### preparar_dia.py
Processes the daily CSV logs to generate a JSON file per day and update
`docs/arquivo/ultimo-dia.json` used by `dia.html`.

```bash
python3 scripts/preparar_dia.py
```

The output paths are similar to the hourly script:

```python
output_dir = base_dir / "docs" / "arquivo"
dia_label = voos_dia[0]["hora"][:10]
output_path = output_dir / f"{dia_label}.json"
```

### publicar_site.sh
A small helper that calls `preparar_site.py` and commits the updated files to
Git. Execute it with:

```bash
./scripts/publicar_site.sh
```
This script is triggered hourly via cron to publish the updated site.




## Generating the `docs/` site

1. Run `captura_adsb.py` periodically to gather new data. This repository uses
   a cron job to execute it every minute.
2. Optionally run `gerar_resumo_avioes.py` to refresh the auxiliary JSON files.
3. Run `preparar_site.py` to create a new JSON file in `docs/arquivo/` with the
   current hour (e.g. `docs/arquivo/2025-07-12_00.json`) and update
   `docs/arquivo/ultima.json`.
4. Run `preparar_dia.py` to build the daily summary and update
   `docs/arquivo/ultimo-dia.json`.
5. Serve the contents of the `docs/` directory with any static web server or
   push them to GitHub Pages. The `publicar_site.sh` script, executed hourly via
   cron, automates the generation and commit of these files.

## License

This project is licensed under the [MIT License](LICENSE).

