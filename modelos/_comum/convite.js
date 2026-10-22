(function () {
  // Os dados do convite chegam de convite.json, injectados pelo scripts/construir.mjs.
  var C = window.CONVITE;
  var reduzir = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Convidado vem do link (?c=Familia-Silva&n=4). Sem parâmetros, o convite é geral.
  // &m=3 indica a mesa do convidado, nos modelos que têm o elemento #mesa.
  var convidado = "", lugares = 0, mesa = "";
  try {
    var q = new URLSearchParams(location.search);
    convidado = (q.get("c") || "").replace(/-/g, " ").trim().slice(0, 60);
    lugares = Math.min(10, Math.max(0, parseInt(q.get("n"), 10) || 0));
    mesa = (q.get("m") || "").trim().slice(0, 20);
  } catch (e) {}
  var elMesa = document.getElementById("mesa");
  if (mesa && elMesa) {
    elMesa.querySelector("b").textContent = mesa;
    elMesa.hidden = false;
  }
  if (convidado) {
    document.getElementById("saudacao").textContent = "Querida(o) " + convidado + ",";
    document.getElementById("env-para").textContent = convidado;
    document.getElementById("nome").value = convidado;
  }
  if (lugares) {
    var el = document.getElementById("lugares");
    el.textContent = lugares === 1 ? "Convite para 1 pessoa" : "Convite para " + lugares + " pessoas";
    el.hidden = false;
    var p = document.getElementById("pessoas");
    p.max = lugares; p.value = lugares;
    document.getElementById("rot-pessoas").textContent = "Quantas pessoas vêm? (máximo " + lugares + ")";
  }

  // Música de fundo (opcional: "musica" no convite.json). O YouTube só deixa tocar com som depois de um
  // toque do utilizador, por isso o leitor é preparado logo à partida (escondido, fora do ecrã) e o
  // playVideo() é chamado dentro do clique que abre o envelope. Criá-lo só no clique falhava no iOS,
  // porque o carregamento assíncrono da API já perdia o "gesto" do utilizador.
  var musica = null;
  if (C.musica && C.musica.youtube) {
    (function () {
      var pronto = false, pedido = false, tocar = false, leitor, botao;
      function actualizarBotao() {
        botao.classList.toggle("mudo", !tocar);
        botao.setAttribute("aria-label", tocar ? "Pausar a música" : "Tocar a música");
      }
      function arrancar() {
        pedido = true;
        if (!pronto) return;
        leitor.setVolume(C.musica.volume || 60);
        leitor.playVideo();
      }
      botao = document.createElement("button");
      botao.type = "button";
      botao.className = "musica-btn mudo";
      botao.hidden = true;
      botao.setAttribute("aria-label", "Tocar a música");
      botao.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/><path class="corte" d="M3 3l18 18"/></svg>';
      botao.addEventListener("click", function () {
        if (!pronto) return;
        if (tocar) leitor.pauseVideo(); else arrancar();
      });
      document.body.appendChild(botao);

      var alvo = document.createElement("div");
      alvo.id = "musica-leitor";
      alvo.setAttribute("aria-hidden", "true");
      document.body.appendChild(alvo);
      window.onYouTubeIframeAPIReady = function () {
        leitor = new YT.Player("musica-leitor", {
          width: 200, height: 200, videoId: C.musica.youtube,
          playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0, start: C.musica.inicio || 0 },
          events: {
            onReady: function () { pronto = true; if (pedido) arrancar(); },
            onStateChange: function (e) {
              tocar = e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING;
              // Em ciclo: o convite pode ficar aberto mais tempo do que dura a música.
              if (e.data === YT.PlayerState.ENDED) { leitor.seekTo(C.musica.inicio || 0); leitor.playVideo(); }
              actualizarBotao();
            },
            // Vídeo removido ou sem permissão de incorporação: o convite continua a funcionar, sem som.
            onError: function () { botao.hidden = true; pedido = false; }
          }
        });
      };
      var s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
      musica = { tocar: function () { botao.hidden = false; arrancar(); } };
    })();
  }

  // Envelope
  var env = document.getElementById("envelope");
  var abrir = document.getElementById("abrir");
  document.body.classList.add("fechado");
  abrir.focus({ preventScroll: true });
  abrir.addEventListener("click", function () {
    if (env.classList.contains("aberto")) return;
    env.classList.add("aberto");
    if (musica) musica.tocar();
    // O cartão (ou a capa) começa a aparecer quando o envelope já está a sair do ecrã.
    setTimeout(function () { document.body.classList.add("revelado"); }, reduzir ? 0 : 750);
    setTimeout(function () {
      env.hidden = true;
      document.body.classList.remove("fechado");
      window.scrollTo(0, 0);
    }, reduzir ? 50 : 1900);
  });

  // Contagem decrescente
  var alvo = new Date(C.data.iso).getTime();
  function dois(n) { return n < 10 ? "0" + n : String(n); }
  // Só mexe no número quando ele muda, e reinicia a animação "tique" nesse momento.
  function escrever(id, valor) {
    var el = document.getElementById(id);
    if (el.textContent === String(valor)) return;
    el.textContent = valor;
    if (reduzir) return;
    el.classList.remove("tique"); void el.offsetWidth; el.classList.add("tique");
  }
  function tick() {
    var s = Math.floor(Math.max(0, alvo - Date.now()) / 1000);
    escrever("c-dias", Math.floor(s / 86400));
    escrever("c-horas", dois(Math.floor(s % 86400 / 3600)));
    escrever("c-min", dois(Math.floor(s % 3600 / 60)));
    escrever("c-seg", dois(s % 60));
  }
  tick(); setInterval(tick, 1000);

  // Aparecer ao rolar, e entrada em cascata do cartão/capa ([data-entrada]) depois do envelope.
  if ("IntersectionObserver" in window && !reduzir) {
    document.documentElement.classList.add("anim");
    document.querySelectorAll("[data-entrada]").forEach(function (bloco) {
      Array.prototype.forEach.call(bloco.children, function (filho, i) { filho.style.setProperty("--i", i); });
    });
    var obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("vis"); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll(".rv").forEach(function (n) { obs.observe(n); });
  }

  // Copiar contas. Se o clipboard for recusado, selecciona o texto para copiar à mão.
  document.querySelectorAll("[data-copiar]").forEach(function (b) {
    b.addEventListener("click", function () {
      var original = b.textContent;
      var code = b.parentNode.querySelector("code");
      function voltar(t) { b.textContent = t; setTimeout(function () { b.textContent = original; }, 1800); }
      function seleccionar() {
        var r = document.createRange(); r.selectNodeContents(code);
        var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        voltar("Seleccionado");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(b.dataset.copiar).then(function () { voltar("Copiado"); }, seleccionar);
      } else { seleccionar(); }
    });
  });

  // RSVP: a página não tem servidor, por isso a resposta segue por WhatsApp.
  function preencher(modelo, valores) {
    return modelo.replace(/\{(\w+)\}/g, function (_, k) { return valores[k] != null ? valores[k] : ""; });
  }
  var form = document.getElementById("rsvp");
  var campoPessoas = document.getElementById("campo-pessoas");
  form.addEventListener("change", function () { campoPessoas.hidden = form.vai.value === "nao"; });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = document.getElementById("nome").value.trim();
    var caixa = document.getElementById("resposta");
    var texto = document.getElementById("resposta-texto");
    var link = document.getElementById("resposta-link");
    if (!nome) {
      caixa.hidden = false; link.hidden = true;
      texto.textContent = "Escreva o seu nome para continuar.";
      document.getElementById("nome").focus();
      return;
    }
    var vai = form.vai.value === "sim";
    var max = lugares || 6;
    var n = Math.min(max, Math.max(1, parseInt(document.getElementById("pessoas").value, 10) || 1));
    var alim = document.getElementById("alim").value.trim();
    var msg = document.getElementById("msg").value.trim();
    var corpo = preencher(vai ? C.whatsapp.mensagemSim : C.whatsapp.mensagemNao, {
      nome: nome, pessoas: n + (n === 1 ? " pessoa" : " pessoas")
    });
    if (vai && alim) corpo += " Restrições alimentares: " + alim + ".";
    if (msg) corpo += " " + msg;
    link.hidden = false;
    link.href = "https://wa.me/" + C.whatsapp.numero + "?text=" + encodeURIComponent(corpo);
    texto.textContent = "Quase lá. Toque no botão para enviar a sua resposta aos noivos pelo WhatsApp. Só fica confirmada depois de enviada.";
    caixa.hidden = false;
  });
})();
