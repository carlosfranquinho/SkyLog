import requests

icao = "3c6538"  # exemplo

url = f"https://opensky-network.org/api/metadata/aircraft/icao24/{icao}"
resp = requests.get(url)
data = resp.json()

import pprint
pprint.pprint(data)
