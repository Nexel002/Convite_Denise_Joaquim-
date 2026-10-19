// Constrói um convite: junta o modelo (HTML, CSS, JS) com os dados de convites/<slug>/convite.json
// e escreve dist/<slug>/index.html, pronto a publicar como site estático (Vercel, Netlify, etc.).
//
// Uso:
//   node scripts/construir.mjs <slug> [--url https://endereco-publico/] [--autonomo]
//   node scripts/construir.mjs --todos
//
//   --url        endereço público do convite. Só com ele a pré-visualização do WhatsApp mostra a foto
//                (o og:image tem de ser um endereço absoluto).
//   --autonomo   mete as imagens dentro do HTML (base64), para um único ficheiro que abre com duplo clique.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (nome) => args.includes(nome);
const valorDe = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };

const lerJson = (caminho) => JSON.parse(readFileSync(caminho, "utf8").replace(/^﻿/, ""));
const escapar = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const falhar = (msg) => { console.error(`Erro: ${msg}`); process.exit(1); };

function obter(dados, caminho) {
  const v = caminho.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dados);
  if (v === undefined || v === null) falhar(`falta o campo "${caminho}" no convite.json.`);
  return v;
}

const TIPOS_IMAGEM = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

function construir(slug) {
  const pasta = join(RAIZ, "convites", slug);
  if (!existsSync(join(pasta, "convite.json"))) falhar(`não existe convites/${slug}/convite.json.`);
  const dados = lerJson(join(pasta, "convite.json"));
  const pastaModelo = join(RAIZ, "modelos", dados.modelo);
  if (!existsSync(pastaModelo)) falhar(`o modelo "${dados.modelo}" não existe em modelos/.`);

  // Ficheiros que o modelo não define próprios vêm de modelos/_comum/ (icones.json, convite.js).
  const comum = join(RAIZ, "modelos", "_comum");
  const doModelo = (nome) => (existsSync(join(pastaModelo, nome)) ? join(pastaModelo, nome) : join(comum, nome));
  const icones = lerJson(doModelo("icones.json"));
  const definicao = lerJson(join(pastaModelo, "modelo.json"));
  // Na Vercel o endereço público do projecto vem em VERCEL_PROJECT_PRODUCTION_URL (sem https://),
  // por isso a foto de pré-visualização do WhatsApp fica certa sem ninguém escrever o --url.
  const urlDaVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
  const urlBase = (valorDe("--url") || urlDaVercel).replace(/\/?$/, "/").replace(/^\/$/, "");
  const autonomo = flag("--autonomo");

  // Imagens: validadas antes de gerar nada, para o erro apontar o campo e não uma imagem partida.
  const caminhoImagem = (chave) => {
    const img = obter(dados, `imagens.${chave}`);
    const ficheiro = join(pasta, "imagens", img.ficheiro);
    if (!existsSync(ficheiro)) falhar(`a imagem "${img.ficheiro}" (imagens.${chave}) não está em convites/${slug}/imagens/.`);
    return { ficheiro, nome: img.ficheiro };
  };
  const urlImagem = (chave) => {
    const { ficheiro, nome } = caminhoImagem(chave);
    if (!autonomo) return `imagens/${nome}`;
    const tipo = TIPOS_IMAGEM[extname(nome).toLowerCase()] || "application/octet-stream";
    return `data:${tipo};base64,${readFileSync(ficheiro).toString("base64")}`;
  };

  // Blocos repetidos. Cada um recebe a lista do JSON e devolve HTML.
  const fragmentos = {
    historiaTitulo: () => obter(dados, "historia.titulo").map(escapar).join("<br>"),
    paleta: () => obter(dados, "dress.cores").map((c) => `<i style="background:${escapar(c)}"></i>`).join(""),
    // Cada coluna tem título opcional; cada nome é texto ou { nome, memoria: true } ("Em memória").
    pais: () => obter(dados, "pais").map((p) => {
      const nomes = p.nomes.map((n) => typeof n === "string" ? escapar(n)
        : `${escapar(n.nome)}${n.memoria ? `<br><small class="memoria">(Em Memória)</small>` : ""}`);
      return `      <div>${p.titulo ? `<h3>${escapar(p.titulo)}</h3>` : ""}${nomes.map((n) => `<p>${n}</p>`).join("")}</div>`;
    }).join("\n"),
    // Resumo do programa para o cartão: ícone, título e "descrição · hora" (a hora é texto livre: "14h30").
    programaLinhas: () => obter(dados, "programa").map((p) => {
      const traco = icones[p.icone];
      if (!traco) falhar(`ícone "${p.icone}" desconhecido. Disponíveis: ${Object.keys(icones).join(", ")}.`);
      const sub = [p.descricao, p.hora].filter(Boolean).map(escapar).join(" · ");
      return `      <div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${traco}"/></svg><p><b>${escapar(p.titulo)}</b>${sub ? `<br><span class="h">${sub}</span>` : ""}</p></div>`;
    }).join("\n"),
    // "imagem" é opcional e aponta para uma chave de "imagens" (foto no topo do cartão do local).
    locais: () => obter(dados, "locais").map((l) => `    <div class="local-cartao">
      ${l.imagem ? `<img class="foto-larga" src="${urlImagem(l.imagem)}" alt="${escapar(obter(dados, `imagens.${l.imagem}.alt`))}">` : ""}
      ${l.rotulo ? `<p class="rotulo">${escapar(l.rotulo)}</p>` : ""}
      <h3>${escapar(l.nome)}</h3>
      <p>${l.morada.map(escapar).join("<br>")}</p>
      <div class="botoes">
        <a class="btn cheio" href="${escapar(l.mapa)}" target="_blank" rel="noopener">Abrir mapa</a>${l.waze ? `
        <a class="btn" href="${escapar(l.waze)}" target="_blank" rel="noopener">Waze</a>` : ""}
      </div>
    </div>`).join("\n"),
    programa: () => obter(dados, "programa").map((p) => {
      const traco = icones[p.icone];
      if (!traco) falhar(`ícone "${p.icone}" desconhecido. Disponíveis: ${Object.keys(icones).join(", ")}.`);
      return `      <li>
        <div class="icone"><svg viewBox="0 0 24 24"><path d="${traco}"/></svg></div>
        <div><time>${escapar(p.hora)}</time><strong>${escapar(p.titulo)}</strong><span class="d">${escapar(p.descricao)}</span></div>
      </li>`;
    }).join("\n"),
    contas: () => obter(dados, "presentes.contas").map((c) =>
      `        <div class="conta"><div><small>${escapar(c.rotulo)}</small><code>${escapar(c.texto)}</code></div><button type="button" data-copiar="${escapar(c.copiar)}">Copiar</button></div>`).join("\n"),
    faq: () => obter(dados, "faq").map((f) =>
      `      <details><summary>${escapar(f.pergunta)}</summary><p>${escapar(f.resposta)}</p></details>`).join("\n"),
  };

  // Template: secções opcionais, imagens, fragmentos e valores simples.
  let corpo = readFileSync(join(pastaModelo, "corpo.template.html"), "utf8");
  corpo = corpo.replace(/<!--sec:(\w+)-->([\s\S]*?)<!--\/sec-->\r?\n?/g, (_, nome, miolo) =>
    (dados.seccoes?.[nome] === false ? "" : miolo));
  // Blocos com imagem opcional: desaparecem se o convite não definir essa imagem.
  corpo = corpo.replace(/<!--opt:(\w+)-->([\s\S]*?)<!--\/opt-->\r?\n?/g, (_, chave, miolo) =>
    (dados.imagens?.[chave] ? miolo : ""));
  corpo = corpo.replace(/\{\{img:(\w+)\}\}/g, (_, chave) => urlImagem(chave));
  corpo = corpo.replace(/\{\{@(\w+)\}\}/g, (_, nome) => {
    if (!fragmentos[nome]) falhar(`o template pede o bloco "{{@${nome}}}", que não existe no construir.mjs.`);
    return fragmentos[nome]();
  });
  corpo = corpo.replace(/\{\{([\w.]+)\}\}/g, (_, caminho) => escapar(obter(dados, caminho)));

  // Só o necessário vai para o browser: a lista de convidados e outros dados do projecto ficam de fora.
  const publico = { data: { iso: dados.data.iso }, whatsapp: dados.whatsapp };
  const configuracao = JSON.stringify(publico).replace(/</g, "\\u003c");

  const temCapa = Boolean(dados.imagens?.capa);
  const og = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapar(dados.titulo)}">`,
    `<meta property="og:description" content="${escapar(dados.textos.convite)}">`,
    urlBase && temCapa ? `<meta property="og:image" content="${escapar(urlBase + "imagens/" + caminhoImagem("capa").nome)}">` : "",
    urlBase ? `<meta property="og:url" content="${escapar(urlBase)}">` : "",
  ].filter(Boolean).join("\n");

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapar(dados.titulo)}</title>
<meta name="robots" content="noindex">
${og}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${escapar(definicao.fontes)}" rel="stylesheet">
<style>
html, body { margin: 0; }
[hidden] { display: none !important; }
${readFileSync(join(comum, "base.css"), "utf8")}
${readFileSync(join(comum, "envelope.css"), "utf8")}
${readFileSync(join(pastaModelo, "estilos.css"), "utf8")}
</style>
</head>
<body>
${corpo}
<script>window.CONVITE = ${configuracao};</script>
<script>
${readFileSync(doModelo("convite.js"), "utf8")}
</script>
</body>
</html>
`;

  // --saida <pasta> escreve directamente nessa pasta (é o que a Vercel publica: "Output Directory").
  // Recusa a raiz do projecto ou pastas fora dele, porque a pasta de destino é apagada antes de escrever.
  const saida = valorDe("--saida");
  const destino = saida ? resolve(RAIZ, saida) : join(RAIZ, "dist", slug);
  if (saida && (destino === RAIZ || !destino.startsWith(RAIZ + sep))) falhar(`--saida tem de ser uma subpasta do projecto (recebi "${saida}").`);
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, "index.html"), html, "utf8");
  if (!autonomo && existsSync(join(pasta, "imagens"))) {
    mkdirSync(join(destino, "imagens"), { recursive: true });
    for (const f of readdirSync(join(pasta, "imagens"))) copyFileSync(join(pasta, "imagens", f), join(destino, "imagens", f));
  }
  console.log(`OK  ${destino.slice(RAIZ.length + 1).replace(/\\/g, "/")}/index.html${autonomo ? " (autónomo, imagens incluídas)" : ""}`);
}

if (flag("--todos")) {
  for (const d of readdirSync(join(RAIZ, "convites"), { withFileTypes: true })) if (d.isDirectory()) construir(d.name);
} else {
  // Na Vercel o convite vem da variável CONVITE do projecto (um projecto Vercel por convite).
  const slug = args.find((a) => !a.startsWith("--") && a !== valorDe("--url") && a !== valorDe("--saida")) || process.env.CONVITE;
  if (!slug) falhar("indica o convite: node scripts/construir.mjs <slug>   (ou --todos, ou a variável CONVITE)");
  construir(slug);
}
