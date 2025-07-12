async function carregarPainel() {
  try {
    const resp = await fetch("painel.json");
    const dados = await resp.json();

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

      ulHora.innerHTML += `
        <li>
          <strong>${v.chamada || v.hex}</strong>: ${v.cia || ""}, ${v.pais}
          <br>– avistado às ${hm}${v.dist ? ` a ${v.dist} km de distância` : ""}
          ${altM !== null ? `<br>– Altitude: ${altM} metros` : ""}
          ${velK !== null ? `<br>– Velocidade: ${velK} km/h` : ""}
        </li>`;
    });

    const ulPaises = document.getElementById("top-paises-lista");
    dados.top_paises.forEach(p => {
      ulPaises.innerHTML += `<li>${p.bandeira || ""} ${p.pais}: ${p.total} aviões</li>`;
    });

    const ulCias = document.getElementById("top-companhias-lista");
    dados.top_companhias.forEach(c => {
      ulCias.innerHTML += `<li>${c.cia}: ${c.total} voos</li>`;
    });

    const canvas = document.getElementById("mapa");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#888";
    ctx.font = "16px sans-serif";
    ctx.fillText("Mapa de rotas (por implementar)", 20, 100);
  } catch (e) {
    console.error("Erro ao carregar painel:", e);
  }
}

carregarPainel();
