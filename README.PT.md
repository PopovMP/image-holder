# Hospedagem de Imagens

[![Twitter Follow](https://img.shields.io/twitter/follow/PopovMP.svg?style=social&maxAge=3600)](https://twitter.com/PopovMP)

Hospedagem de imagens / envio de imagens

É um sistema simples de Auto-hospedagem 'self-hosted' para imagens

## Características

- Image Holder é um aplicativo que roda em node.js
- Fornece um upload de imagens de arrastar / soltar.
- Armazena os arquivos e miniaturas em uma pasta local pública.
- Pode exigir uma chave de acesso para um upload (definido nas configurações do servidor).
- Mostra a última visualização de imagens no carregamento.
- Tem uma pesquisa RegExp através de todas as imagens enviadas.
- Gerencia arquivos duplicados.
- Valida o tamanho da imagem, a extensão do arquivo e o tipo MIME.
- Mostra código para integração em fóruns (o formato do código é personalizável).

Image Holder em ação: <https://image-holder.forexsb.com/>

![Screnshot](https://image-holder.forexsb.com/store/image-holder-screenshot.png)

## Requisitos

Node.js <https://nodejs.org>

## Configurações

settings.json

```json
{
  "acceptedFiles": ["png", "jpg", "jpeg"],
  "maxFileSizeKb": 1024,
  "passCode": 42,
  "port": 8080,
  "storagePath": "store",
  "metaFilePath": "db/meta.json",
  "maxSearchCount": 20,
  "showLastImages": 20,
  "thumbnailPattern": "[URL=img-url][IMG]thumb-url[/IMG][/URL]",
  "thumbnailWidth": 300,
  "thumbnailHeight": 200
}
```

O passCode pode ser um número ou uma string. Se for 0 ou "", a entrada "Código de acesso" ficará oculta.

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
