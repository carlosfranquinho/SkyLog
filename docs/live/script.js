const API_URL = "https://share-physics-gulf-changing.trycloudflare.com/dados";

const map = L.map('map').setView([39.5, -8.0], 7); // centro de Portugal

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
}).addTo(map);

let aircraftMarkers = {};

function fetchAircraft() {
  fetch(API_URL)
    .then(response => response.json())
    .then(data => {
      const now = Date.now() / 1000;
      const seenThreshold = now - 60; // só mostrar aviões recentes

      const novos = {};

      (data.aircraft || []).forEach(ac => {
        if (!ac.lat || !ac.lon || ac.seen > 60) return;

        const key = ac.hex;
        const pos = [ac.lat, ac.lon];
        const info = ac.flight ? ac.flight.trim() : ac.hex.toUpperCase();

        if (aircraftMarkers[key]) {
          aircraftMarkers[key].setLatLng(pos);
        } else {
            const heading = ac.track || 0; // graus (0 = norte)
            const marker = L.marker(pos, {
            icon: createPlaneIcon(heading)
            }).addTo(map)
            .bindPopup(`<strong>${info}</strong><br>Alt: ${ac.alt_baro || '-'} ft`);
            // Atualiza a direção:
            const icon = createPlaneIcon(ac.track || 0);
            aircraftMarkers[key].setIcon(icon);        }

        novos[key] = true; // marca como ainda ativo
      });

      // Remover marcadores que já não estão ativos
      for (const key in aircraftMarkers) {
        if (!novos[key]) {
          map.removeLayer(aircraftMarkers[key]);
          delete aircraftMarkers[key];
        }
      }
    })
    .catch(err => console.error("Erro ao buscar dados:", err));
}

// Atualizar de 10 em 10 segundos
fetchAircraft();
setInterval(fetchAircraft, 5000);
