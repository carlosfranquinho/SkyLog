async function carregarPainel() {
  try {
    const resp = await fetch("painel.json");
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

    const ulHora = document.getElementById("ultima-hora-lista");
    dados.ultima_hora.forEach(v => {
      const dt = new Date(v.hora + "Z");
      const opt = {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Lisbon",
      };
      const hm = new Intl.DateTimeFormat("pt-PT", opt)
        .format(dt)
        .replace(":", "h") + "m";

      const altM = v.alt ? Math.round(parseFloat(v.alt) * 0.3048) : null;
      const velK = v.vel ? Math.round(parseFloat(v.vel) * 1.852) : null;

      const localTxt = v.local ? `sobre ${capitalizar(v.local)} ` : "";
      const bandeira = v.bandeira ? v.bandeira + " " : "";

      ulHora.innerHTML += `
        <li>
          <strong>${v.chamada || v.hex}</strong>: ${v.cia || ""}, ${bandeira}${v.pais}
          <br>– avistado ${localTxt}às ${hm}${v.dist ? ` a ${v.dist} km de distância` : ""}
          ${altM !== null ? `<br>– Altitude: ${altM} metros` : ""}
          ${velK !== null ? `<br>– Velocidade: ${velK} km/h` : ""}
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

      resumoEl.textContent =
        `Na última hora foram detetados ${total} aviões de ${paisesSet.size} países e ${ciasSet.size} companhias. ` +
        `O avião mais distante estava a ${maxDist}km sobre ${capitalizar(maxLoc)} e o mais próximo a ${minDist}km, sobre ${capitalizar(minLoc)}. ` +
        `Entre estes avistamentos, houve ${semLoc} aviões que não partilharam a sua localização.`;
    }

    const ulCias = document.getElementById("top-companhias-lista");
    dados.top_companhias.forEach(c => {
      ulCias.innerHTML += `<li><strong>${c.cia}</strong>: ${c.total} voos</li>`;
    });

    const map = L.map("mapa").setView([39.7078, -8.0570], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap"
    }).addTo(map);

    const planeIcon = L.divIcon({ className: "plane-icon", html: "✈️", iconSize: [20,20], iconAnchor: [10,10] });

    dados.rotas.forEach(r => {
      if (!r.de || !r.para) return;
      const ini = [r.de[0], r.de[1]];
      const fim = [r.para[0], r.para[1]];
      L.polyline([ini, fim], { color: "red", weight: 2 }).addTo(map);
      L.marker(fim, { icon: planeIcon }).addTo(map);
    });
  } catch (e) {
    console.error("Erro ao carregar painel:", e);
  }
}

carregarPainel();
