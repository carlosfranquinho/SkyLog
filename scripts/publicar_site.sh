#!/usr/bin/env bash

# Caminho base do projeto
PROJECT_DIR="${BASE_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PYTHON_SCRIPT_HORARIO="$PROJECT_DIR/scripts/preparar_site.py"
PYTHON_SCRIPT_DIARIO="$PROJECT_DIR/scripts/preparar_dia.py"

# Entrar na pasta do projeto
cd "$PROJECT_DIR" || exit 1

# Executar o script Python
python3 "$PYTHON_SCRIPT"

# Se for entre as 00:00 e as 00:59, correr o script diário
HORA_ATUAL=$(date +%H)
if [[ "$HORA_ATUAL" == "00" ]]; then
  python3 "$PYTHON_SCRIPT2"
fi

# Fazer commit e push para o GitHub
git add .
git commit -m "Atualização automática via cron"
git push origin main
