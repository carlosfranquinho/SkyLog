const API_URL = "https://skylog.franquinho.info/data/aircraft.json";

const ESTACAO_LAT = 39.74759200010467;
const ESTACAO_LON = -8.936510104648143;

    const initialZoom = 7;
    const center = [39.6625, -7.7848];
    const map = L.map("mapa", {
      dragging: false,
      minZoom: 7,
      maxZoom: 18,
      touchZoom: "center",
    }).setView(center, initialZoom);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
  opacity: 0.65,
}).addTo(map);

let aircraftMarkers = {};
let rastosPorAeronave = {};
let linhasRasto = {};
const listaAvioes = document.getElementById('lista-avioes');
const painelProximo = document.getElementById('mais-proximo');
const fotoCache = {};
let ultimoProximoHex = null;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}


// Aplica uma cor à imagem branca com contorno, usando CSS filter
function cssFilterFromColor(hex) {
  return `drop-shadow(0 0 0 ${hex}) brightness(0) saturate(1000%)`;
}

// Define a cor consoante a altitude
function getColorByAltitude(alt) {
  if (!alt) return "#888";
  if (alt > 40000) return "#d500f9"; // violeta
  if (alt > 35000) return "#ff1744"; // vermelho
  if (alt > 30000) return "#ff9100"; // laranja forte
  if (alt > 25000) return "#ffc400"; // laranja
  if (alt > 20000) return "#c0ca33"; // verde-amarelado
  if (alt > 15000) return "#4caf50"; // verde
  if (alt > 10000) return "#00bcd4"; // azul claro
  if (alt > 5000) return "#2196f3";  // azul
  return "#3f51b5";                  // azul escuro
}

// Cria ícone com rotação e cor
function getImageByCategory(cat) {
  if (!cat) return 'images/a0.png';
  const c = cat.toUpperCase();
  if (c === 'A3') return 'images/a3.png';
  if (c === 'A2') return 'images/a2.png';
  if (c === 'A1') return 'images/a1.png';
  if (c === 'A0') return 'images/a0.png';
  if (c.startsWith('B')) return 'images/bx.png';
  if (c.startsWith('C')) return 'images/cx.png';
  if (c === 'E0') return 'images/e0.png';
  return 'images/a0.png';
}

function createPlaneIcon(track = 0, altitude = 0, category = '') {
  const color = getColorByAltitude(altitude);
  const img = getImageByCategory(category);
  const size = 30;

  return L.divIcon({
    className: "plane-icon",
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; transform: rotate(${track}deg);">
        <!-- camada inferior (contorno preto) -->
        <div style="
          position: absolute;
          top: 0; left: 0;
          width: ${size}px; height: ${size}px;
          -webkit-mask-image: url('${img}');
          mask-image: url('${img}');
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          -webkit-mask-size: contain;
          mask-size: contain;
          background-color: black;
          /* removido o desfoque que criava uma aura involuntária */
          filter: none;
          z-index: 0;
        "></div>

        <!-- camada superior (avião colorido) -->
        <div style="
          position: absolute;
          top: 0; left: 0;
          width: ${size}px; height: ${size}px;
          -webkit-mask-image: url('${img}');
          mask-image: url('${img}');
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          -webkit-mask-size: contain;
          mask-size: contain;
          background-color: ${color};
          z-index: 1;
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function atualizarPainelMaisProximo(ac, dist) {
  if (!painelProximo) return;
  const info = ac.flight ? ac.flight.trim() : ac.hex.toUpperCase();
  const altM = ac.alt_baro ? Math.round(ac.alt_baro * 0.3048) : null;
  const vel = ac.gs ? Math.round(ac.gs * 1.852) : null;
  const heading = ac.track || 0;
  const hora = new Date().toLocaleTimeString('pt-PT', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const foto = fotoCache[ac.hex];
  let fotoHtml = '';
  if (foto) {
    fotoHtml = `<a href="${foto.link}" target="_blank" rel="noopener">
      <img src="${foto.url}" alt="Foto aeronave"><br>
      <small>Foto: ${foto.photographer}</small>
    </a>`;
  } else if (ultimoProximoHex !== ac.hex) {
    fetch(`https://api.planespotters.net/pub/photos/hex/${ac.hex}`)
      .then(r => r.json())
      .then(j => {
        const p = j.photos && j.photos[0];
        if (p) {
          const thumb = (p.thumbnail_large && p.thumbnail_large.src) ||
                        (p.thumbnail && p.thumbnail.src);
          if (thumb) {
            fotoCache[ac.hex] = {
              url: thumb,
              link: p.link,
              photographer: p.photographer
            };
            atualizarPainelMaisProximo(ac, dist);
          }
        }
      })
      .catch(() => {});
  }

  painelProximo.innerHTML = `
    ${fotoHtml}
    <p><strong>${info}</strong> (${ac.hex.toUpperCase()})</p>
    <ul>${altM !== null ? `<strong>Altitude:</strong> ${altM} m` : ''}</ul>
    <ul>${vel !== null ? `<strong>Velocidade:</strong> ${vel} km/h` : ''}</ul>
    <ul><strong>Rumo:</strong> ${heading.toFixed(0)}º</ul>
    <ul><strong>Distância:</strong> ${dist.toFixed(1)} km</ul>
    <ul>Atualizado às ${hora}</ul>
  `;
  ultimoProximoHex = ac.hex;
}


// Vai buscar os dados e atualiza o mapa
function fetchAircraft() {
  fetch(API_URL)
    .then(response => response.json())
    .then(data => {
      const now = Date.now() / 1000;
      const seenThreshold = now - 60; // mostrar apenas aviões recentes

      const novos = {};
      listaAvioes.innerHTML = "";
      let prox = null;
      let distProx = Infinity;

      (data.aircraft || []).forEach(ac => {
        if (!ac.lat || !ac.lon || ac.seen > 60) return;

        const key = ac.hex;
        const pos = [ac.lat, ac.lon];
        const info = ac.flight ? ac.flight.trim() : ac.hex.toUpperCase();
        const heading = ac.track || 0;
        const altitude = ac.alt_baro || 0;
        const category = ac.category || '';
        const velocidade = ac.gs ? Math.round(ac.gs * 1.852) : null;

        if (aircraftMarkers[key]) {
          aircraftMarkers[key].setLatLng(pos);
          aircraftMarkers[key].setIcon(createPlaneIcon(heading, altitude, category));
        } else {
          const marker = L.marker(pos, {
            icon: createPlaneIcon(heading, altitude, category)
          }).addTo(map)
            .bindPopup(`<strong>${info}</strong><br>Alt: ${altitude} ft`);
          aircraftMarkers[key] = marker;
        }

        if (!rastosPorAeronave[key]) {
          rastosPorAeronave[key] = [];
        }
        rastosPorAeronave[key].push(pos);
        if (linhasRasto[key]) {
          linhasRasto[key].setLatLngs(rastosPorAeronave[key]);
          linhasRasto[key].setStyle({ color: getColorByAltitude(altitude) });
        } else {
          linhasRasto[key] = L.polyline(rastosPorAeronave[key], {
            color: getColorByAltitude(altitude),
            weight: 2
          }).addTo(map);
        }

        novos[key] = true; // marca como ainda ativo
        const altM = altitude ? Math.round(altitude * 0.3048) : null;
        const distNum = haversine(ESTACAO_LAT, ESTACAO_LON, ac.lat, ac.lon);
        const dist = distNum.toFixed(1);
        const hora = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        listaAvioes.innerHTML += `<li><strong>${info}</strong>
          <ul>${altM !== null ? `<strong>Altitude:</strong> ${altM} m` : ''}</ul>
          <ul>${velocidade !== null ? `<strong>Velocidade:</strong> ${velocidade} km/h` : ''}</ul>
          <ul><strong>Rumo:</strong> ${heading.toFixed(0)}º</ul>
          <ul><strong>Distância:</strong> ${dist} km</ul>
          <ul>Atualizado às ${hora}</ul>
        </li>`;
        if (distNum < distProx) {
          prox = ac;
          distProx = distNum;
        }
      });

      // Remove os que já não estão ativos
      for (const key in aircraftMarkers) {
        if (!novos[key]) {
          map.removeLayer(aircraftMarkers[key]);
          if (linhasRasto[key]) {
            map.removeLayer(linhasRasto[key]);
            delete linhasRasto[key];
          }
          delete aircraftMarkers[key];
          delete rastosPorAeronave[key];
        }
      }

      if (prox) {
        atualizarPainelMaisProximo(prox, distProx);
      }
    })
    .catch(err => console.error("Erro ao buscar dados:", err));
}

fetchAircraft();
setInterval(fetchAircraft, 3000);
