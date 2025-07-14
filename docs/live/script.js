// script.js

const API_URL = "https://share-physics-gulf-changing.trycloudflare.com/dados";

const map = L.map('map').setView([39.5, -8.0], 7);

L.tileLayer('https://tile.openstreetmap.org/{z}/{y}/{x}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

let aircraftMarkers = {};
let rastosPorAeronave = {};
let linhasRasto = {};
let setasRasto = {};

// Cores estilo tar1090
function getColorByAltitude(alt) {
  if (!alt) return '#888888';
  if (alt < 500) return '#ff0000';
  if (alt < 2000) return '#ff8000';
  if (alt < 6000) return '#ffff00';
  if (alt < 10000) return '#00ff00';
  if (alt < 20000) return '#00ffff';
  if (alt < 30000) return '#0000ff';
  if (alt < 40000) return '#8000ff';
  return '#ff00ff';
}

function createPlaneIcon(track = 0, altitude = 0) {
  const color = getColorByAltitude(altitude);
  const size = 40;

  return L.divIcon({
    className: "plane-icon",
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; transform: rotate(${track}deg);">
        <div style="
          position: absolute;
          top: 0; left: 0;
          width: ${size}px; height: ${size}px;
          -webkit-mask-image: url('images/plane.png');
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-size: contain;
          background-color: black;
          filter: blur(1px);
          z-index: 0;
        "></div>
        <div style="
          position: absolute;
          top: 0; left: 0;
          width: ${size}px; height: ${size}px;
          -webkit-mask-image: url('images/plane.png');
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-size: contain;
          background-color: ${color};
          z-index: 1;
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function atualizarRasto(key, novaPos, color) {
  if (!rastosPorAeronave[key]) rastosPorAeronave[key] = [];
  rastosPorAeronave[key].push(novaPos);
  if (rastosPorAeronave[key].length > 60) rastosPorAeronave[key].shift();

  if (linhasRasto[key]) {
    map.removeLayer(linhasRasto[key]);
    map.removeLayer(setasRasto[key]);
  }

  const polyline = L.polyline(rastosPorAeronave[key], { color, weight: 2 }).addTo(map);
  const decorator = L.polylineDecorator(polyline, {
    patterns: [
      {
        offset: 0,
        repeat: 20,
        symbol: L.Symbol.arrowHead({ pixelSize: 6, polygon: false, pathOptions: { stroke: true, color } })
      }
    ]
  }).addTo(map);

  linhasRasto[key] = polyline;
  setasRasto[key] = decorator;
}

function fetchAircraft() {
  fetch(API_URL)
    .then(r => r.json())
    .then(data => {
      const now = Date.now() / 1000;
      const ativos = {};

      (data.aircraft || []).forEach(ac => {
        if (!ac.lat || !ac.lon || ac.seen > 60) return;

        const key = ac.hex;
        const pos = [ac.lat, ac.lon];
        const heading = ac.track || 0;
        const altitude = ac.alt_baro || 0;
        const color = getColorByAltitude(altitude);

        if (aircraftMarkers[key]) {
          aircraftMarkers[key].setLatLng(pos);
          aircraftMarkers[key].setIcon(createPlaneIcon(heading, altitude));
        } else {
          aircraftMarkers[key] = L.marker(pos, {
            icon: createPlaneIcon(heading, altitude)
          }).addTo(map).bindPopup(`<strong>${ac.flight || ac.hex}</strong><br>Alt: ${altitude} ft`);
        }

        atualizarRasto(key, pos, color);
        ativos[key] = true;
      });

      // Remover aviões desaparecidos
      for (const key in aircraftMarkers) {
        if (!ativos[key]) {
          map.removeLayer(aircraftMarkers[key]);
          delete aircraftMarkers[key];

          if (linhasRasto[key]) map.removeLayer(linhasRasto[key]);
          if (setasRasto[key]) map.removeLayer(setasRasto[key]);

          delete rastosPorAeronave[key];
          delete linhasRasto[key];
          delete setasRasto[key];
        }
      }
    })
    .catch(err => console.error("Erro ao buscar dados:", err));
}

fetchAircraft();
setInterval(fetchAircraft, 5000);
