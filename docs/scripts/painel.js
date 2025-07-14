
async function carregarPainel() {
  try {
    const params = new URLSearchParams(window.location.search);
    const horaParam = params.get("h");
    const ficheiro = horaParam
      ? `arquivo/${horaParam}.json`
      : `arquivo/ultima.json`;
    const resp = await fetch(ficheiro);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dados = await resp.json();

    const bandeiras = {};
    dados.top_paises.forEach(p => {
      bandeiras[p.pais] = p.bandeira;
    });

    function capitalizar(str) {
      return str
        .toLowerCase()
        .split(" ")
        .map(p =>
          p
            .split("-")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join("-")
        )
        .join(" ");
    }

    function calcBearing(lat1, lon1, lat2, lon2) {
      const toRad = d => (d * Math.PI) / 180;
      const dLon = toRad(lon2 - lon1);
      const y = Math.sin(dLon) * Math.cos(toRad(lat2));
      const x =
        Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
      return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    }

    function formatLabel(date) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const hh = String(date.getHours()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}_${hh}`;
    }

    const currentLabel = formatLabel(new Date(dados.ultima_hora[0].hora));
    const baseLabel = horaParam || currentLabel;
    const baseDate = new Date(baseLabel.replace("_", "T") + ":00");

    const prevLabel = formatLabel(new Date(baseDate.getTime() - 3600 * 1000));
    const nextLabel = formatLabel(new Date(baseDate.getTime() + 3600 * 1000));

    const btnPrev = document.getElementById("hora-anterior");
    if (btnPrev) btnPrev.onclick = () => {
      window.location.search = "?h=" + prevLabel;
    };

    const btnNext = document.getElementById("hora-seguinte");
    if (btnNext) {
      if (horaParam) {
        btnNext.onclick = () => {
          if (nextLabel === currentLabel) {
            window.location.search = "";
          } else {
            window.location.search = "?h=" + nextLabel;
          }

        };
      } else {
        btnNext.disabled = true;
      }
    }

    const ulHora = document.getElementById("ultima-hora-lista");
    dados.ultima_hora.forEach(v => {
      const hm = v.hora.slice(11, 16).replace(":", "h") + "m";

      const altM = v.alt ? Math.round(parseFloat(v.alt) * 0.3048) : null;
      const velK = v.vel ? Math.round(parseFloat(v.vel) * 1.852) : null;

      const localTxt = v.local ? `sobre ${capitalizar(v.local)} ` : "";
      const bandeira = v.bandeira ? v.bandeira + " " : "";

      ulHora.innerHTML += `
        <li>
          <strong>${v.chamada || v.hex}</strong>: ${v.cia || ""}, ${bandeira}${v.pais}
          ${v.origem && v.destino ? `<br>- Origem: ${v.origem} - Destino: ${v.destino}` : ""}
          <br>– avistado ${localTxt}às ${hm}${v.dist ? ` a ${v.dist} km de distância` : ""}
          ${altM !== null ? `<br>- Altitude: ${altM} metros` : ""}
          ${velK !== null ? `<br>- Velocidade: ${velK} km/h` : ""}
        </li>`;
    });

    const ulPaises = document.getElementById("top-paises-lista");
    dados.top_paises.forEach(p => {
      ulPaises.innerHTML += `<li>${p.bandeira || ""} <strong>${p.pais}</strong>: ${p.total} aviões</li>`;
    });

    // resumo "Na última hora"
    const resumoEl = document.getElementById("resumo-ultima-hora");
    if (resumoEl) {
      const total = dados.ultima_hora.length;
      const paisesSet = new Set();
      const ciasSet = new Set();
      let maxDist = -Infinity;
      let maxLoc = "";
      let minDist = Infinity;
      let minLoc = "";
      let semLoc = 0;

      dados.ultima_hora.forEach(v => {
        if (v.pais) paisesSet.add(v.pais);
        if (v.cia) ciasSet.add(v.cia);
        const dist = parseFloat(v.dist);
        if (isNaN(dist)) {
          semLoc += 1;
          return;
        }
        if (dist > maxDist) {
          maxDist = dist;
          maxLoc = v.local || "";
        }
        if (dist < minDist) {
          minDist = dist;
          minLoc = v.local || "";
        }
      });

      const horaRef = dados.ultima_hora[0].hora.slice(11, 13);
      const h = horaRef.padStart(2, "0");
      const prox = String((parseInt(h, 10) + 2) % 24).padStart(2, "0");

      resumoEl.textContent =
        `Entre as ${h}h00m e as ${h}h59 foram detetados ${total} aviões de ${paisesSet.size} países e ${ciasSet.size} companhias. ` +
        `O avião mais distante estava a ${maxDist}km sobre ${capitalizar(maxLoc)} e o mais próximo a ${minDist}km, sobre ${capitalizar(minLoc)}. ` +
        `Entre estes avistamentos, houve ${semLoc} aviões que não partilharam a sua localização. ` +
        `Próxima atualização às ${prox}h03m.`;
    }

    const ulCias = document.getElementById("top-companhias-lista");
    dados.top_companhias.forEach(c => {
      ulCias.innerHTML += `<li><strong>${c.cia}</strong>: ${c.total} voos</li>`;
    });

    const initialZoom = 7;
    const center = [39.6625, -7.7848];
    const map = L.map("mapa", {
      dragging: false,
      minZoom: 7,
      maxZoom: 18,
      touchZoom: "center",
    }).setView(center, initialZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(map);

    const initialBounds = map.getBounds();
    map.setMaxBounds(initialBounds);
    map.options.maxBoundsViscosity = 1.0;
    map.on("zoomend", () => {
      if (map.getZoom() > initialZoom) {
        map.dragging.enable();
      } else {
        map.dragging.disable();
      }
    });

    function destPoint(lat, lon, brng, distKm) {
      const R = 6371;
      const toRad = d => (d * Math.PI) / 180;
      const toDeg = d => (d * 180) / Math.PI;
      const b = toRad(brng);
      const d = distKm / R;
      const lat1 = toRad(lat);
      const lon1 = toRad(lon);
      const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b)
      );
      const lon2 =
        lon1 +
        Math.atan2(
          Math.sin(b) * Math.sin(d) * Math.cos(lat1),
          Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        );
      return [toDeg(lat2), toDeg(lon2)];
    }

    function directionColor(bearing) {
      const h = ((bearing % 360) + 360) % 360;
      return `hsl(${h}, 80%, 45%)`;
    }

    function desenharSeta(inicio, fim, bearing, cor) {
      L.polyline([inicio, fim], { color: cor, weight: 2 }).addTo(map);
      const len = 5; // arrowhead length in km
      const left = destPoint(fim[0], fim[1], bearing + 210, len);
      const right = destPoint(fim[0], fim[1], bearing + 150, len);
      L.polygon([left, fim, right], { color: cor, fillColor: cor, weight: 1 }).addTo(map);

    }

    dados.rotas.forEach(r => {
      if (!r.de || !r.para) return;
      const ini = [r.de[0], r.de[1]];
      const fim = [r.para[0], r.para[1]];
      const bearing = calcBearing(ini[0], ini[1], fim[0], fim[1]);
      const cor = directionColor(bearing);
      desenharSeta(ini, fim, bearing, cor);

    });
  } catch (e) {
    console.error("Erro ao carregar painel:", e);
  }
}

carregarPainel();
