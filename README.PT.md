# Hospedagem de Imagens

[![Twitter Follow](https://img.shields.io/twitter/follow/PopovMP.svg?style=social&maxAge=3600)](https://twitter.com/PopovMP)

Hospedagem de imagens / envio de imagens

É um sistema simples de Auto-hospedagem 'self-hosted' para imagens

## Características

- Image Holder é um aplicativo que roda em node.js
- Fornece um upload de imagens de arrastar / soltar.
- Armazena os arquivos e miniaturas em uma pasta local pública.
- A interface administrativa e a API são protegidas por uma senha de acesso com "lembrar de mim".
- As imagens continuam públicas, para poderem ser incorporadas em fóruns.
- Mostra a última visualização de imagens no carregamento.
- Tem uma pesquisa por texto literal através de todas as imagens enviadas.
- Gerencia arquivos duplicados.
- Valida o tamanho, a extensão, os bytes mágicos e o tipo MIME da imagem.
- Mostra código para integração em fóruns (o formato do código é personalizável).

Image Holder em ação: <https://image-holder.forexsb.com/>

![Screnshot](https://image-holder.forexsb.com/store/image-holder-screenshot.png)

## Requisitos

Node.js <https://nodejs.org>

## Configurações

O settings.json contém apenas configuração, sem segredos (ele vai para o git).

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
  "showLastImages": 20,
  "thumbnailPattern": "[URL=img-url][IMG]thumb-url[/IMG][/URL]",
  "thumbnailWidth": 300,
  "thumbnailHeight": 200
}
```

## Autenticação

Não há credenciais neste repositório. A senha fica em `config/auth.json`, que
é ignorado pelo git e criado com permissão 600, guardando apenas um hash scrypt:

```shell
npm run set-password                    # pede uma senha
npm run set-password -- --generate      # gera uma senha aleatória forte
npm run set-password -- --rotate-secret # encerra a sessão de todos os dispositivos
```

As sessões são cookies assinados (`HttpOnly`, `Secure`, `SameSite=Strict`)
registrados em `config/sessions.json`, portanto sair realmente invalida o token
no servidor. As tentativas de login são limitadas por IP.

Os caminhos `/store/`, `/assets/` e `/favicon.ico` continuam públicos - é isso
que permite incorporar as imagens. Todo o resto exige sessão.

## Instalação

Depois de clonar o repo, rode no shell

```shell
npm install
```

e

```shell
npm start
```

para iniciar o software

## Powered by

Forex Software Ltd. at <https://forexsb.com/>

## Colaboradores

- [Vinicius Pereira](https://github.com/vinibpereira/)

## Licença

MIT Copyright © 2012-present, Miroslav Popov
