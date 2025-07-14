// Dependências externas obrigatórias no HTML:
// - Leaflet
// - Leaflet.PolylineDecorator (https://github.com/bbecquet/Leaflet.PolylineDecorator)

const API_URL = "https://share-physics-gulf-changing.trycloudflare.com/dados";

const map = L.map('map').setView([39.5, -8.0], 7);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

let aircraftMarkers = {};
let rastosPorAeronave = {};
let linhasRasto = {};
let decoradores = {};

// Gradiente de cores tipo tar1090 (altitude em metros)
function getColorByAltitude(alt) {
  if (!alt) return '#888';
  if (alt > 12000) return '#cc00ff';
  if (alt > 9000)  return '#0000ff';
  if (alt > 6000)  return '#00ccff';
  if (alt > 3000)  return '#00cc00';
  if (alt > 1800)  return '#99cc00';
  if (alt > 600)   return '#cccc00';
  if (alt > 300)   return '#ff9900';
  return '#ff3300';
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

function fetchAircraft() {
  fetch(API_URL)
    .then(r => r.json())
    .then(data => {
      const now = Date.now() / 1000;
      const seenThreshold = now - 60;
      const novos = {};

      (data.aircraft || []).forEach(ac => {
        if (!ac.lat || !ac.lon || ac.seen > 60) return;

        const key = ac.hex;
        const pos = [ac.lat, ac.lon];
        const info = ac.flight ? ac.flight.trim() : ac.hex.toUpperCase();
        const heading = ac.track || 0;
        const altitude = ac.alt_geom || 0;
        const cor = getColorByAltitude(altitude);

        if (!rastosPorAeronave[key]) rastosPorAeronave[key] = [];
        rastosPorAeronave[key].push(pos);
        if (rastosPorAeronave[key].length > 20) rastosPorAeronave[key].shift();

        if (aircraftMarkers[key]) {
          aircraftMarkers[key].setLatLng(pos);
          aircraftMarkers[key].setIcon(createPlaneIcon(heading, altitude));
        } else {
          aircraftMarkers[key] = L.marker(pos, {
            icon: createPlaneIcon(heading, altitude)
          }).addTo(map).bindPopup(`<strong>${info}</strong><br>Alt: ${altitude} m`);
        }

        // Atualiza ou cria linha de rasto
        if (linhasRasto[key]) {
          linhasRasto[key].setLatLngs(rastosPorAeronave[key]);
        } else {
          linhasRasto[key] = L.polyline(rastosPorAeronave[key], {
            color: cor,
            weight: 2,
            opacity: 0.8
          }).addTo(map);
        }

        // Atualiza ou cria decorador (setinhas)
        if (decoradores[key]) map.removeLayer(decoradores[key]);
        if (rastosPorAeronave[key].length >= 2) {
          decoradores[key] = L.polylineDecorator(linhasRasto[key], {
            patterns: [
              { offset: 5, repeat: 10, symbol: L.Symbol.arrowHead({ pixelSize: 6, polygon: false, pathOptions: { stroke: true, color: cor } }) }
            ]
          }).addTo(map);
        }

        novos[key] = true;
      });

      // Remover aviões desaparecidos
      for (const key in aircraftMarkers) {
        if (!novos[key]) {
          map.removeLayer(aircraftMarkers[key]);
          map.removeLayer(linhasRasto[key]);
          if (decoradores[key]) map.removeLayer(decoradores[key]);
          delete aircraftMarkers[key];
          delete rastosPorAeronave[key];
          delete linhasRasto[key];
          delete decoradores[key];
        }
      }
    })
    .catch(err => console.error("Erro ao buscar dados:", err));
}

fetchAircraft();
setInterval(fetchAircraft, 5000);
