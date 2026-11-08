# Image Holder

[![Twitter Follow](https://img.shields.io/twitter/follow/PopovMP.svg?style=social&maxAge=3600)](https://twitter.com/PopovMP)

It is a very simple self-hosted image holder service.

## Features

- Image Holder is a self hosted app on node.js
- it provides a Drag / Drop images upload.
- it stores the files and thumbnails in a public local folder.
- the admin UI and the API are protected by a password login with "remember me".
- uploaded images stay publicly reachable, so they can be hot-linked from forums.
- it shows the latest images preview on load.
- it has a literal-text search through all uploaded images.
- it manages duplicated files.
- it validates the image size, file extension, magic bytes and the mime type.
- it shows code for integration in forums (the code format is customizable).

Image Holder in action: <https://image-holder.forexsb.com/>

![Screnshot](https://image-holder.forexsb.com/store/image-holder-screenshot.png)

## Requirements

Node.js <https://nodejs.org/>

## Settings

settings.json holds non-secret configuration only: it is committed to git.

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

`publicBaseUrl` is used to build the permanent links stored in the database. It
is never taken from the request, so a spoofed `Host`/`Origin` header cannot
poison stored URLs.

## Authentication

There are no credentials in this repository. The password lives in
`config/auth.json`, which is git-ignored and created with mode 600:

```json
{
  "passwordHash": "scrypt$16384$8$1$...",
  "sessionSecret": "<64 hex characters>",
  "sessionVersion": 0,
  "sessionHours": 12,
  "rememberDays": 30
}
```

Only a scrypt hash is stored - never the password itself.

Set or change it with:

```shell
npm run set-password                    # prompts for a password
npm run set-password -- --generate      # generates a strong random one
npm run set-password -- --rotate-secret # also signs out every device
```

Sessions are signed cookies (`HttpOnly`, `Secure`, `SameSite=Strict`) tracked in
`config/sessions.json`, so signing out really revokes the token on the server.
Login attempts are rate limited per IP with exponential lockout.

The `/store/`, `/assets/` and `/favicon.ico` paths stay public - that is what
makes the images hot-linkable. Everything else requires a session.

## Installation

After cloning this repo, run

```shell
npm install
```

Set a password (logins are refused until this is done):

```shell
npm run set-password
```

and

```shell
npm start
```

to start the app

## Powered by

Forex Software Ltd. at <https://forexsb.com/>

## Contributors

- [Vinicius Pereira](https://github.com/vinibpereira/)

## License

MIT License Copyright © 2012-present, Miroslav Popov
