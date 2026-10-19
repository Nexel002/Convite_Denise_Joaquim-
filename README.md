# Convites digitais

Convites em página estática (HTML, CSS e JS, sem dependências). Cada tipo de evento tem um **modelo**; cada convite é só um ficheiro de dados (`convite.json`) mais as suas imagens. Precisa apenas de Node 18 ou superior.

## Estrutura

```
modelos/
  _comum/                 partilhado por todos os modelos
    base.css              reset, tipografia, botões, formulário, rodapé
    envelope.css          envelope de abertura
    convite.js            comportamento (envelope, contagem, link por convidado, confirmação por WhatsApp)
    icones.json           ícones do programa (nome -> traço SVG)
  casamento/              oceano e ocre, com fotografias
  casamento-folhagem/     cartão branco com folhagem e monograma (inspirado num convite impresso)
    modelo.json           nome do modelo e tipos de letra (Google Fonts)
    corpo.template.html   estrutura da página, com {{marcadores}}
    estilos.css           tema (variáveis :root) e aspecto próprio do modelo
convites/
  ana-e-carlos/           modelo "casamento"
  denise-e-joaquim/       modelo "casamento-folhagem"
  (cada convite:)
    convite.json          TODOS os textos, datas, contactos e opções deste convite
    imagens/              fotografias do convite
    convidados.exemplo.csv  formato da lista de convidados
    convidados.csv        a lista real (ignorada pelo git: dados privados)
scripts/
  construir.mjs           modelo + convite.json -> dist/<slug>/
  gerar-links.mjs         convidados.csv -> um link por convidado
dist/                     o que se publica (gerado, ignorado pelo git)
saida/                    links e listas privadas (gerado, ignorado pelo git)
```

Regra de ouro: **nada específico de um convite vive em `modelos/`**, e nada de aspecto ou comportamento vive em `convites/`. Se precisares de mudar um texto, é no `convite.json`; se precisares de mudar o aspecto para todos os convites, é no modelo.

## Dia a dia

```bash
# construir um convite (abre dist/<slug>/index.html no browser)
node scripts/construir.mjs ana-e-carlos

# com o endereço público: a pré-visualização do WhatsApp passa a mostrar a foto
node scripts/construir.mjs ana-e-carlos --url https://anaecarlos.vercel.app/

# um único ficheiro com as imagens dentro, que abre com duplo clique
node scripts/construir.mjs ana-e-carlos --autonomo

# links por convidado (precisa de convites/ana-e-carlos/convidados.csv, com colunas nome,lugares,telemovel,mesa)
node scripts/gerar-links.mjs ana-e-carlos --url https://anaecarlos.vercel.app/
```

Os mesmos comandos existem como `npm run construir -- <slug>` e `npm run links -- <slug> --url ...`.

## Criar um convite novo (mesmo modelo)

1. Copiar `convites/ana-e-carlos/` para `convites/<novo-slug>/`.
2. Editar `convite.json` (nomes, data, local, programa, contas, perguntas, número de WhatsApp).
3. Trocar as imagens em `imagens/` e ajustar os nomes em `"imagens"` dentro do `convite.json`.
4. Desligar o que não se usa em `"seccoes"` (por exemplo `"presentes": false`).
5. `node scripts/construir.mjs <novo-slug>`.

Se faltar um campo ou uma imagem, o script pára e diz qual.

## Criar um modelo novo (baptizado, aniversário, empresa...)

1. Copiar `modelos/casamento/` para `modelos/<novo-modelo>/`.
2. Mudar o `corpo.template.html` e o `estilos.css`. O `:root` do `estilos.css` tem de definir as variáveis do tema (`--papel`, `--tinta`, `--primaria`, `--destaque`, etc.), que a base e o envelope usam. Marcadores disponíveis:
   - `{{campo.subcampo}}`: valor do `convite.json`, já protegido contra HTML.
   - `{{img:chave}}`: caminho da imagem `imagens.<chave>`.
   - `{{@bloco}}`: lista gerada pelo `construir.mjs` (`programa`, `programaLinhas`, `pais`, `locais`, `contas`, `faq`, `paleta`, `historiaTitulo`). Um bloco novo acrescenta-se em `fragmentos`, no `construir.mjs`.
   - `<!--sec:nome-->...<!--/sec-->`: secção que se desliga com `"seccoes": { "nome": false }`.
   - `<!--opt:chave-->...<!--/opt-->`: bloco que só aparece se o convite definir `imagens.<chave>` (convites sem fotografias ficam sem ele).
3. Criar o `modelo.json` (nome e endereço das fontes) e, no `convite.json` do convite, pôr `"modelo": "<novo-modelo>"`.

## Link por convidado

O convite lê o convidado do endereço: `?c=Familia-Silva&n=4&m=7` mostra "Família Silva", "Convite para 4 pessoas", e limita a confirmação a 4. O `m` (mesa) só aparece nos modelos que têm esse campo, como o `casamento-folhagem`. Sem parâmetros mostra o convite geral. O `gerar-links.mjs` cria estes links e a mensagem de WhatsApp de cada um em `saida/<slug>/links.html`.

- Nomes com hífen verdadeiro perdem-no (o hífen é lido como espaço).
- Qualquer pessoa pode editar o nome no endereço. Só muda o texto no ecrã dela.
- O número de lugares não é uma garantia: quem controla a entrada é a lista, não o link.

## Confirmação de presença

A página não tem servidor. A confirmação abre o WhatsApp dos noivos com a mensagem pronta (`whatsapp.mensagemSim` e `mensagemNao` no `convite.json`), e só fica registada depois de o convidado a enviar. Para ter uma lista central com contagem seria preciso guardar as respostas num serviço (ainda não existe).

## Publicar na Vercel

Publica-se **a pasta `dist/<slug>/`**, não a raiz do projecto.

```bash
node scripts/construir.mjs ana-e-carlos --url https://anaecarlos.vercel.app/
cd dist/ana-e-carlos
npx vercel --prod
```

O nome do projecto na Vercel define o endereço. Escolhe-o antes e usa o mesmo no `--url`, senão a foto não aparece na pré-visualização do WhatsApp. Cada convite é um projecto Vercel separado.

## Privacidade

- `convidados.csv`, `saida/` e `dist/` estão no `.gitignore`. A lista de convidados nunca deve ir para o `dist/` nem para um repositório.
- O HTML publicado leva `noindex`, por isso os motores de busca não o listam. Quem tiver o link consegue vê-lo.
- Os dados de pagamento (M-Pesa, e-Mola, NIB) do `convite.json` ficam visíveis a quem abrir o convite. Confirma-os antes de publicar.

## Dados de teste

O convite `ana-e-carlos` usa nomes, contactos e NIB inventados, e fotografias da Unsplash apenas para ver o aspecto. Substituir tudo antes de publicar.

O convite `denise-e-joaquim` usa os dados reais do convite impresso, sem fotografias. A folhagem e a coroa de louro do cartão são SVG desenhados à mão, que se trocam pelos ficheiros originais do ilustrador.
