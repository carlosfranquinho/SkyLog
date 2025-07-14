const API_URL = "https://share-physics-gulf-changing.trycloudflare.com/dados";

const map = L.map('map').setView([39.5, -8.0], 7); // centro de Portugal

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
}).addTo(map);

let aircraftMarkers = {};
let rastosPorAeronave = {};
let linhasRasto = {};

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
  const size = 40;

  return L.divIcon({
    className: "plane-icon",
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; transform: rotate(${track}deg);">
        <!-- camada inferior (contorno preto) -->
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

        <!-- camada superior (avião colorido) -->
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

// Vai buscar os dados e atualiza o mapa
function fetchAircraft() {
  fetch(API_URL)
    .then(response => response.json())
    .then(data => {
      const now = Date.now() / 1000;
      const novos = {};

      (data.aircraft || []).forEach(ac => {
        if (!ac.lat || !ac.lon || ac.seen > 60) return;

        const key = ac.hex;
        const pos = [ac.lat, ac.lon];
        const info = ac.flight ? ac.flight.trim() : ac.hex.toUpperCase();
        const heading = ac.track || 0;
        const altitude = ac.alt_baro || 0;

        // Inicializa o rasto se não existir
        if (!rastosPorAeronave[key]) rastosPorAeronave[key] = [];

        const rasto = rastosPorAeronave[key];
        // Só adiciona se mudou de posição
        if (rasto.length === 0 || rasto[rasto.length - 1][0] !== pos[0] || rasto[rasto.length - 1][1] !== pos[1]) {
          rasto.push(pos);
        }

        // Atualiza ou cria o marcador
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

        // Atualiza ou cria o rasto (linha)
        if (linhasRasto[key]) {
          linhasRasto[key].setLatLngs(rasto);
        } else {
          linhasRasto[key] = L.polyline(rasto, {
            color: getColorByAltitude(altitude),
            weight: 2,
            opacity: 0.5,
          }).addTo(map);
        }

        novos[key] = true; // marca como ativo
      });

      // Limpeza: remover os que desapareceram
      for (const key in aircraftMarkers) {
        if (!novos[key]) {
          map.removeLayer(aircraftMarkers[key]);
          delete aircraftMarkers[key];
        }
      }
      for (const key in linhasRasto) {
        if (!novos[key]) {
          map.removeLayer(linhasRasto[key]);
          delete linhasRasto[key];
          delete rastosPorAeronave[key];
        }
      }
    })
    .catch(err => console.error("Erro ao buscar dados:", err));
}

fetchAircraft();
setInterval(fetchAircraft, 5000);
