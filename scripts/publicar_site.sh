#!/usr/bin/env bash

# Caminho base do projeto
PROJECT_DIR="${BASE_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PYTHON_SCRIPT="$PROJECT_DIR/scripts/preparar_site.py"
JSON_FILE="$PROJECT_DIR/docs/hora_corrente.json"
ARCHIVE_DIR="$PROJECT_DIR/docs/arquivo"

# Entrar na pasta do projeto
cd "$PROJECT_DIR" || exit 1

# Arquivar o ficheiro anterior, se existir
if [ -f "$JSON_FILE" ]; then
    TS=$(python3 - "$JSON_FILE" <<'EOF' | tr -d '\n'
import json
import sys
with open(sys.argv[1]) as f:
    d=json.load(f)
print(d["ultima_hora"][0]["hora"][:13])
EOF
)
    mkdir -p "$ARCHIVE_DIR"
    mv "$JSON_FILE" "$ARCHIVE_DIR/${TS//T/_}.json"
fi

# Executar o script Python
python3 "$PYTHON_SCRIPT"

# Fazer commit e push para o GitHub
git add .
git commit -m "Atualização automática via cron"
git push origin main
