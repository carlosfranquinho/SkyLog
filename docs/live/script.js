//const API_URL = "https://share-physics-gulf-changing.trycloudflare.com/dados";
const API_URL = "http://localhost:5000/dados";

const map = L.map("map").setView([39.5, -8.0], 7); // centro de Portugal

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

let aircraftMarkers = {};
let aircraftTrails = {};

function colorFromAltitude(alt) {
  if (alt > 30000) return "hue-rotate(0deg)";      // vermelho
  if (alt > 15000) return "hue-rotate(60deg)";     // amarelo
  return "hue-rotate(120deg)";                     // verde
}

function createPlaneIcon(track = 0, alt = 0) {
  const filter = colorFromAltitude(alt);
  return L.divIcon({
    className: "plane-icon",
    html: `<img src="images/plane.png" style="width: 40px; transform: rotate(${track}deg); filter: ${filter};">`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function fetchAircraft() {
  fetch(API_URL)
    .then((response) => response.json())
    .then((data) => {
      const now = Date.now() / 1000;
      const novos = {};

      (data.aircraft || []).forEach((ac) => {
        if (!ac.lat || !ac.lon || ac.seen > 60) return;

        const key = ac.hex;
        const pos = [ac.lat, ac.lon];
        const info = ac.flight ? ac.flight.trim() : ac.hex.toUpperCase();
        const heading = ac.track || 0;
        const altitude = ac.alt_baro || 0;

        // Rasto
        if (!aircraftTrails[key]) {
          aircraftTrails[key] = [pos];
        } else {
          const last = aircraftTrails[key][aircraftTrails[key].length - 1];
          if (last[0] !== pos[0] || last[1] !== pos[1]) {
            aircraftTrails[key].push(pos);
            if (aircraftTrails[key].length > 10) {
              aircraftTrails[key].shift(); // manter só últimos 10
            }
          }
        }

        // Atualiza ou cria marcador
        if (aircraftMarkers[key]) {
          aircraftMarkers[key].setLatLng(pos);
          aircraftMarkers[key].setIcon(createPlaneIcon(heading, altitude));
        } else {
          const marker = L.marker(pos, {
            icon: createPlaneIcon(heading, altitude),
          })
            .addTo(map)
            .bindPopup(
              `<strong>${info}</strong><br>Alt: ${altitude} ft`
            );
          aircraftMarkers[key] = marker;
        }

        // Adiciona ou atualiza linha do rasto
        if (aircraftTrails[key]) {
          if (aircraftTrails[key].polyline) {
            map.removeLayer(aircraftTrails[key].polyline);
          }
          aircraftTrails[key].polyline = L.polyline(aircraftTrails[key], {
            color: "#888",
            weight: 1.5,
            opacity: 0.5,
            dashArray: "2, 4",
          }).addTo(map);
        }

        novos[key] = true;
      });

      // Remover marcadores e rastos inativos
      for (const key in aircraftMarkers) {
        if (!novos[key]) {
          map.removeLayer(aircraftMarkers[key]);
          if (aircraftTrails[key]?.polyline) {
            map.removeLayer(aircraftTrails[key].polyline);
          }
          delete aircraftMarkers[key];
          delete aircraftTrails[key];
        }
      }
    })
    .catch((err) => console.error("Erro ao buscar dados:", err));
}

// Atualizar de 5 em 5 segundos
fetchAircraft();
setInterval(fetchAircraft, 5000);
