# Hospedagem de Imagens

[![Twitter Follow](https://img.shields.io/twitter/follow/PopovMP.svg?style=social&maxAge=3600)](https://twitter.com/PopovMP)

Hospedagem de imagens / envio de imagens

Um pequeno serviço de auto-hospedagem ('self-hosted') de imagens em Node.js.
Arraste imagens no navegador e receba um link permanente e o código pronto para
fóruns. Um único usuário, uma única senha, sem servidor de banco de dados.

Image Holder em ação: <https://image-holder.forexsb.com/>

![Screenshot](https://image-holder.forexsb.com/store/image-holder-screenshot.png)

## Características

- Upload por arrastar / soltar (ou clicando para escolher), com as miniaturas
  geradas no próprio navegador antes do envio.
- As últimas imagens são mostradas em uma grade de cartões; a URL permanente e o
  código para fórum ficam em um campo que basta clicar para selecionar.
- Pesquisa por texto literal em todas as imagens enviadas.
- Detecção de arquivos duplicados pelo hash do conteúdo, com a opção explícita
  "Force upload".
- Validação de tamanho, extensão, bytes mágicos e tipo MIME.
- As imagens enviadas continuam públicas, para poderem ser incorporadas em fóruns
  e outros sites.
- A interface administrativa e a API são protegidas por uma senha com
  "lembrar de mim".
- Apenas três dependências em tempo de execução: `express`, `pug`, `morgan`.

## Requisitos

Node.js 18 ou superior (o app usa scrypt de `node:crypto` e base64url).

## Começando

```shell
npm install
npm run set-password     # pedido uma única vez, na instalação
npm start
```

Depois abra <http://localhost:8080> e faça login.

Os logins são recusados até que uma senha seja definida, portanto o app falha
fechado em vez de rodar desprotegido.

## Configurações

O `settings.json` contém apenas configuração, sem segredos (ele vai para o git).

```json
{
  "acceptedFiles": ["png", "jpg", "jpeg"],
  "maxFileSizeKb": 1024,
  "maxUploadBodyKb": 4096,
  "port": 8080,
  "publicBaseUrl": "https://image-holder.example.com",
  "storagePath": "store",
  "metaFilePath": "db/meta.json",
  "maxSearchCount": 20,
  "showLastImages": 10,
  "thumbnailPattern": "[URL=img-url][IMG]thumb-url[/IMG][/URL]",
  "thumbnailWidth": 300,
  "thumbnailHeight": 200
}
```

| Chave | Significado |
| --- | --- |
| `acceptedFiles` | Extensões permitidas, sem o ponto. |
| `maxFileSizeKb` | Tamanho máximo de uma imagem armazenada. |
| `maxUploadBodyKb` | Limite rígido de toda a requisição de upload (imagem + miniatura em base64). |
| `port` | Porta de escuta. A variável de ambiente `PORT` tem prioridade. |
| `publicBaseUrl` | Origem usada para montar os links permanentes gravados no banco. Nunca vem da requisição, então um cabeçalho `Host`/`Origin` falsificado não consegue envenenar os links gravados. |
| `storagePath` | Pasta sob `public/` onde as imagens e miniaturas são gravadas. |
| `metaFilePath` | O arquivo JSON com os registros das imagens. |
| `maxSearchCount` | Número máximo de resultados devolvidos por uma pesquisa. |
| `showLastImages` | Quantas imagens recentes a página inicial mostra. |
| `thumbnailPattern` | Modelo do código para fórum. `img-url` e `thumb-url` são marcadores e são substituídos onde aparecerem. |
| `thumbnailWidth`, `thumbnailHeight` | Caixa delimitadora da miniatura gerada no navegador. |

## Autenticação

Não há credenciais neste repositório. A senha fica em `config/auth.json`, que é
ignorado pelo git e criado com permissão 600:

```json
{
  "passwordHash": "scrypt$16384$8$1$...",
  "sessionSecret": "<64 caracteres hexadecimais>",
  "sessionVersion": 0,
  "sessionHours": 12,
  "rememberDays": 30
}
```

Apenas um hash scrypt é gravado - nunca a senha em si.

Defina ou troque a senha com:

```shell
npm run set-password                    # pede uma senha
npm run set-password -- --generate      # gera uma senha aleatória forte
npm run set-password -- --rotate-secret # encerra a sessão de todos os dispositivos
```

A nova senha passa a valer no próximo login; não é preciso reiniciar.

É uma instalação de um único usuário: o formulário pede apenas a senha, não há
nome de usuário.

**Sessões.** A sessão é um cookie assinado (`HttpOnly`, `Secure`,
`SameSite=Strict`, com o prefixo `__Host-` quando servido por TLS). As sessões
ativas ficam registradas em `config/sessions.json`, então sair realmente invalida
o token no servidor, e não apenas pede ao navegador para esquecê-lo. O "lembrar
de mim" cria um cookie de 30 dias renovado enquanto o app é usado.

**Quais caminhos são públicos.** `/store/`, `/assets/` e `/favicon.ico` continuam
públicos - é isso que permite incorporar as imagens. A página inicial e toda a
`/api/` exigem sessão.

## Segurança

Os padrões foram escolhidos para uma instalação pequena e privada, exposta à
internet atrás de um proxy reverso:

- **Senhas** são gravadas como hash scrypt e comparadas em tempo constante.
- **Limite de tentativas**: as falhas são contadas por IP, com bloqueio
  exponencial (5 falhas, depois 1 minuto dobrando até 1 hora) e atraso em cada
  tentativa falha. Um freio global barra o palpite distribuído.
- **CSRF**: cookies `SameSite=Strict`, mais a verificação de `Origin` e o
  cabeçalho `X-Requested-With` obrigatório nas chamadas de API, que um formulário
  de outro site não consegue definir.
- **XSS**: todos os metadados exibidos são escapados em HTML, e a
  Content-Security-Policy proíbe scripts e estilos embutidos.
- **Cabeçalhos**: CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS.
- **Uploads** têm limite de corpo, exigem extensão na lista permitida e um nome de
  arquivo conservador (sem barras, aspas, caracteres de controle ou ponto
  inicial), precisam resolver dentro da pasta de armazenamento, precisam ter a
  assinatura de bytes mágicos correspondente, e o formato da miniatura precisa
  casar com o da imagem.
- **Armazenamento** grava o banco de forma atômica (arquivo temporário, fsync,
  rename) e mantém a versão anterior como `meta.json.bak`; um arquivo ilegível é
  posto em quarentena em vez de sobrescrito, nunca começando do zero em silêncio.
- **Dependências** fixadas por um lockfile versionado, e o `npm audit` está limpo.

O que isto não faz: as imagens em `/store/` são legíveis por qualquer pessoa que
saiba ou adivinhe a URL. É a natureza de um serviço de imagens, mas tenha isso em
mente antes de enviar algo privado.

## Arquivos e dados

```
config/auth.json       hash da senha e segredo das sessões   (ignorado pelo git, 600)
config/sessions.json   sessões ativas                        (ignorado pelo git, 600)
db/meta.json           registros das imagens
db/meta.json.bak       cópia boa anterior, usada na recuperação
public/store/          as imagens e suas miniaturas
```

Faça backup de `db/meta.json` e `public/store/` juntos - eles precisam ficar
em sincronia.

## Atrás de um proxy reverso

O app fala HTTP simples e espera um terminador TLS na frente:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

- `X-Forwarded-Proto` faz o app emitir cookies `Secure`/`__Host-` e enviar HSTS.
  Sem ele, as sessões funcionam, mas não são marcadas como seguras.
- O `trust proxy` é limitado ao loopback, então o proxy precisa rodar no mesmo
  host para o limite de tentativas enxergar o IP real do cliente.
- Servir `/store/` e `/assets/` diretamente pelo nginx é opcional (o app também
  os serve). Se fizer isso, um cache longo é seguro: as URLs dos assets carregam
  um `?v=` com hash do conteúdo, então um arquivo alterado sempre vira uma URL
  nova.

## Variáveis de ambiente

| Variável | Para que serve |
| --- | --- |
| `PORT` | Porta de escuta, sobrepõe o `settings.json`. |
| `IMAGE_HOLDER_AUTH_FILE` | Caminho do arquivo de credenciais, em vez de `config/auth.json`. Útil para uma segunda instância ou um ambiente de teste descartável. |

## Powered by

Forex Software Ltd. at <https://forexsb.com/>

## Colaboradores

- [Vinicius Pereira](https://github.com/vinibpereira/)

## Licença

MIT Copyright © 2012-present, Miroslav Popov
