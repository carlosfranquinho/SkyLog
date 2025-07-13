#!/bin/zsh

# Caminho base do projeto
PROJECT_DIR=~/Projetos/SkyLog
SCRIPT_DIR="$PROJECT_DIR/scripts"
PYTHON_SCRIPT="$SCRIPT_DIR/preparar_site.py"

# Entrar na pasta do projeto
cd "$PROJECT_DIR" || exit 1

# Executar o script Python
python3 "$PYTHON_SCRIPT"

# Fazer commit e push para o GitHub
git add .
git commit -m "Atualização automática via cron"
git push origin main
