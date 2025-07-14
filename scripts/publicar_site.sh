#!/usr/bin/env bash

# Caminho base do projeto
PROJECT_DIR="${BASE_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PYTHON_SCRIPT="$PROJECT_DIR/scripts/preparar_site.py"

# Entrar na pasta do projeto
cd "$PROJECT_DIR" || exit 1

# Executar o script Python
python3 "$PYTHON_SCRIPT"

# Fazer commit e push para o GitHub
git add .
git commit -m "Atualização automática via cron"
git push origin main
