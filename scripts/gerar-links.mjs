// Gera um link por convidado a partir de convites/<slug>/convidados.csv.
// Escreve saida/<slug>/links.csv e saida/<slug>/links.html (com botões de copiar e de abrir o WhatsApp).
//
// Uso: node scripts/gerar-links.mjs <slug> --url https://endereco-publico-do-convite/
//
// O CSV tem a primeira linha "nome,lugares,telemovel,mesa" (aceita também ; como separador).
// "telemovel" e "mesa" são opcionais; a mesa só aparece nos modelos que a mostram.
// A saída vai para saida/, nunca para dist/: dist/ é o que se publica, e a lista de convidados é privada.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const i = args.indexOf("--url");
const urlBase = i >= 0 ? args[i + 1] : undefined;
const slug = args.find((a) => !a.startsWith("--") && a !== urlBase);
const falhar = (msg) => { console.error(`Erro: ${msg}`); process.exit(1); };
if (!slug || !urlBase) falhar("uso: node scripts/gerar-links.mjs <slug> --url https://endereco-publico/");

const pasta = join(RAIZ, "convites", slug);
const ficheiroCsv = join(pasta, "convidados.csv");
if (!existsSync(ficheiroCsv)) falhar(`falta convites/${slug}/convidados.csv (há um exemplo em convidados.exemplo.csv).`);
const dados = JSON.parse(readFileSync(join(pasta, "convite.json"), "utf8").replace(/^﻿/, ""));
const modelo = dados.whatsapp.mensagemConvite;
if (!modelo) falhar('falta "whatsapp.mensagemConvite" no convite.json.');

const escapar = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const csvCampo = (s) => `"${String(s).replace(/"/g, '""')}"`;

// Moçambique: 9 dígitos a começar por 8 levam o indicativo 258. Outros formatos ficam como estão.
function telemovel(bruto) {
  const d = String(bruto || "").replace(/\D/g, "");
  if (!d) return "";
  return /^8\d{8}$/.test(d) ? "258" + d : d;
}

const linhas = readFileSync(ficheiroCsv, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
const sep = linhas[0].includes(";") ? ";" : ",";
const convidados = linhas.slice(1).map((l, n) => {
  const [nome, lugares, tel, mesa] = l.split(sep).map((c) => c.trim());
  if (!nome) falhar(`linha ${n + 2} do CSV sem nome.`);
  const nLugares = parseInt(lugares, 10);
  if (!(nLugares >= 1)) falhar(`linha ${n + 2} ("${nome}"): "lugares" tem de ser um número a partir de 1.`);
  // Os espaços viram hífenes porque a página lê o nome do endereço e troca-os de volta.
  const link = `${urlBase.replace(/\/?$/, "/")}?c=${encodeURIComponent(nome.replace(/\s+/g, "-"))}&n=${nLugares}${mesa ? `&m=${encodeURIComponent(mesa)}` : ""}`;
  const mensagem = modelo.replace("{nome}", nome).replace("{link}", link);
  const t = telemovel(tel);
  const whatsapp = `https://wa.me/${t}?text=${encodeURIComponent(mensagem)}`;
  return { nome, lugares: nLugares, telemovel: t, link, mensagem, whatsapp };
});

const saida = join(RAIZ, "saida", slug);
mkdirSync(saida, { recursive: true });

writeFileSync(join(saida, "links.csv"),
  "﻿" + ["nome", "lugares", "telemovel", "link", "mensagem"].join(",") + "\n" +
  convidados.map((c) => [c.nome, c.lugares, c.telemovel, c.link, c.mensagem].map(csvCampo).join(",")).join("\n") + "\n", "utf8");

const linhasHtml = convidados.map((c, n) => `
  <tr>
    <td>${escapar(c.nome)}</td><td>${c.lugares}</td>
    <td class="link"><code>${escapar(c.link)}</code></td>
    <td class="acoes">
      <button type="button" data-copiar="${escapar(c.link)}">Copiar link</button>
      <button type="button" data-copiar="${escapar(c.mensagem)}">Copiar mensagem</button>
      ${c.telemovel ? `<a href="${escapar(c.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : `<span class="sem">sem telemóvel</span>`}
      <label><input type="checkbox" data-n="${n}"> enviado</label>
    </td>
  </tr>`).join("");

writeFileSync(join(saida, "links.html"), `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Links de ${escapar(dados.titulo)}</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:24px;color:#0D2B33}
h1{font-size:20px;margin:0 0 4px} p{margin:0 0 16px;color:#3E5B62}
table{border-collapse:collapse;width:100%} th,td{border-bottom:1px solid #C9D5D0;padding:10px 8px;text-align:left;vertical-align:top}
th{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#3E5B62}
.link{max-width:340px;overflow-wrap:anywhere} .acoes{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button,a{font:inherit;font-size:13px;padding:6px 10px;border:1px solid #0D2B33;background:#fff;color:#0D2B33;cursor:pointer;text-decoration:none}
button:hover,a:hover{background:#0D2B33;color:#fff} .sem{color:#999;font-size:13px}
tr.feito{opacity:.5}
</style></head><body>
<h1>${escapar(dados.titulo)}</h1>
<p>${convidados.length} convites. "Enviado" fica guardado neste browser. Este ficheiro tem dados privados: não o publiques.</p>
<table><thead><tr><th>Convidado</th><th>Lugares</th><th>Link</th><th></th></tr></thead><tbody>${linhasHtml}</tbody></table>
<script>
var chave = "enviados:${escapar(slug)}";
var feitos = {}; try { feitos = JSON.parse(localStorage.getItem(chave) || "{}"); } catch (e) {}
document.querySelectorAll("input[data-n]").forEach(function (c) {
  var tr = c.closest("tr"); c.checked = !!feitos[c.dataset.n]; tr.classList.toggle("feito", c.checked);
  c.addEventListener("change", function () {
    feitos[c.dataset.n] = c.checked; tr.classList.toggle("feito", c.checked);
    try { localStorage.setItem(chave, JSON.stringify(feitos)); } catch (e) {}
  });
});
document.querySelectorAll("[data-copiar]").forEach(function (b) {
  b.addEventListener("click", function () {
    var o = b.textContent;
    navigator.clipboard.writeText(b.dataset.copiar).then(function () { b.textContent = "Copiado"; setTimeout(function () { b.textContent = o; }, 1500); });
  });
});
</script></body></html>
`, "utf8");

console.log(`OK  ${convidados.length} links em saida/${slug}/links.html e links.csv`);
