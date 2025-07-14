const API_URL = "https://share-physics-gulf-changing.trycloudflare.com/dados";

const map = L.map('map').setView([39.5, -8.0], 7); // centro de Portugal

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
}).addTo(map);

let aircraftMarkers = {};
let aircraftTrails = {};
let aircraftHistory = {};

function getColorByAltitude(alt) {
  if (!alt) return "#888";
  if (alt < 5000) return "#00cc00";
  if (alt < 15000) return "#ffff00";
  if (alt < 30000) return "#ff9900";
  return "#ff0000";
}

function createPlaneIcon(track = 0, alt = 0) {
  const color = getColorByAltitude(alt);
  return L.divIcon({
    className: "plane-icon",
    html: `<img src="images/plane.png" style="width: 30px; filter: drop-shadow(0 0 1px ${color}); transform: rotate(${track}deg);">`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function fetchAircraft() {
  fetch(API_URL)
    .then(response => response.json())
    .then(data => {
      const now = Date.now() / 1000;
      const seenThreshold = now - 60;

      const ativos = {};

      (data.aircraft || []).forEach(ac => {
        if (!ac.lat || !ac.lon || ac.seen > 60) return;

        const key = ac.hex;
        const pos = [ac.lat, ac.lon];
        const info = ac.flight ? ac.flight.trim() : ac.hex.toUpperCase();
        const heading = ac.track || 0;
        const alt = ac.alt_baro || 0;

        ativos[key] = true;

        // Atualizar ou criar marcador
        if (aircraftMarkers[key]) {
          aircraftMarkers[key].setLatLng(pos);
          const icon = createPlaneIcon(heading, alt);
          aircraftMarkers[key].setIcon(icon);
        } else {
          const marker = L.marker(pos, {
            icon: createPlaneIcon(heading, alt)
          }).addTo(map)
            .bindPopup(`<strong>${info}</strong><br>Alt: ${alt} ft`);
          aircraftMarkers[key] = marker;
        }

        // Atualizar histórico de posições
        if (!aircraftHistory[key]) aircraftHistory[key] = [];
        aircraftHistory[key].push(pos);
        if (aircraftHistory[key].length > 5) aircraftHistory[key].shift();

        // Atualizar ou criar trilho
        if (aircraftTrails[key]) {
          aircraftTrails[key].setLatLngs(aircraftHistory[key]);
        } else {
          aircraftTrails[key] = L.polyline(aircraftHistory[key], {
            color: "#666",
            weight: 1.5,
            opacity: 0.7
          }).addTo(map);
        }
      });

      // Limpar marcadores inativos
      for (const key in aircraftMarkers) {
        if (!ativos[key]) {
          map.removeLayer(aircraftMarkers[key]);
          delete aircraftMarkers[key];

          if (aircraftTrails[key]) {
            map.removeLayer(aircraftTrails[key]);
            delete aircraftTrails[key];
          }

          delete aircraftHistory[key];
        }
      }
    })
    .catch(err => console.error("Erro ao buscar dados:", err));
}

// Atualiza a cada 5 segundos
fetchAircraft();
setInterval(fetchAircraft, 5000);
