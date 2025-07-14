from flask import Flask, send_file
import os

app = Flask(__name__)

# Caminho absoluto para o teu ficheiro de dados
CAMINHO_DADOS = os.path.expanduser("/run/dump1090-fa/aircraft.json")

@app.route("/")
def home():
    return "<h1>API SkyLog</h1><p>Vai a <code>/dados</code> para obter os dados em JSON.</p>"

@app.route("/dados")
def dados():
    return send_file(CAMINHO_DADOS, mimetype='application/json')

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
