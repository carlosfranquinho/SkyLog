const API_URL = "https://share-physics-gulf-changing.trycloudflare.com/dados";

const map = L.map('map').setView([39.5, -8.0], 7); // centro de Portugal

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
}).addTo(map);

let aircraftMarkers = {};

// Aplica uma cor à imagem branca com contorno, usando CSS filter
function cssFilterFromColor(hex) {
  return `drop-shadow(0 0 0 ${hex}) brightness(0) saturate(1000%)`;
}

// Define a cor consoante a altitude
function getColorByAltitude(alt) {
  if (!alt) return "#888";
  if (alt > 35000) return "#ff0000"; // vermelho
  if (alt > 25000) return "#ff9900"; // laranja
  if (alt > 15000) return "#ffff00"; // amarelo
  if (alt > 5000) return "#00cc00";  // verde
  return "#0066ff";                  // azul
}

// Cria ícone com rotação e cor
function createPlaneIcon(track = 0, altitude = 0) {
  const color = getColorByAltitude(altitude);

  return L.divIcon({
    className: "plane-icon",
    html: `<img src="images/plane.png" style="
      width: 40px;
      transform: rotate(${track}deg);
      filter: ${cssFilterFromColor(color)};
    ">`,
    iconSize: [40, 40],
    iconAnchor: [20, 20], // centro da imagem
  });
}

// Vai buscar os dados e atualiza o mapa
function fetchAircraft() {
  fetch(API_URL)
    .then(response => response.json())
    .then(data => {
      const now = Date.now() / 1000;
      const seenThreshold = now - 60; // mostrar apenas aviões recentes

      const novos = {};

      (data.aircraft || []).forEach(ac => {
        if (!ac.lat || !ac.lon || ac.seen > 60) return;

        const key = ac.hex;
        const pos = [ac.lat, ac.lon];
        const info = ac.flight ? ac.flight.trim() : ac.hex.toUpperCase();
        const heading = ac.track || 0;
        const altitude = ac.alt_baro || 0;

        if (aircraftMarkers[key]) {
          aircraftMarkers[key].setLatLng(pos);
          aircraftMarkers[key].setIcon(createPlaneIcon(heading, altitude));
        } else {
          const marker = L.marker(pos, {
            icon: createPlaneIcon(heading, altitude)
          }).addTo(map)
            .bindPopup(`<strong>${info}</strong><br>Alt: ${altitude} ft`);
          aircraftMarkers[key] = marker;
        }

        novos[key] = true; // marca como ainda ativo
      });

      // Remove os que já não estão ativos
      for (const key in aircraftMarkers) {
        if (!novos[key]) {
          map.removeLayer(aircraftMarkers[key]);
          delete aircraftMarkers[key];
        }
      }
    })
    .catch(err => console.error("Erro ao buscar dados:", err));
}

fetchAircraft();
setInterval(fetchAircraft, 5000);
