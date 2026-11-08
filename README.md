# Image Holder

[![Twitter Follow](https://img.shields.io/twitter/follow/PopovMP.svg?style=social&maxAge=3600)](https://twitter.com/PopovMP)

A small self-hosted image host on Node.js. Drop images in the browser, get a
permanent link and ready-made forum code back. One user, one password, and no
database server to look after.

Image Holder in action: <https://image-holder.forexsb.com/>

![Screenshot](https://image-holder.forexsb.com/store/image-holder-screenshot.png)

## Features

- Drag and drop (or click to select) upload, with thumbnails generated in the
  browser before anything is sent.
- The last images are shown as a card grid; the permanent URL and the forum
  code sit in a field you click to select.
- Literal-text search across every uploaded image.
- Duplicate detection by content hash, with an explicit "Force upload" override.
- Validation of size, extension, magic bytes and mime type.
- Uploaded images stay publicly fetchable, so they can be hot-linked from
  forums and other sites.
- The admin UI and the API are protected by a password login with "remember me".
- Only three runtime dependencies: `express`, `pug`, `morgan`.

## Requirements

Node.js 18 or newer (the app uses `node:crypto` scrypt and base64url support).

## Quick start

```shell
npm install
npm run set-password     # asked once, at install time
npm start
```

Then open <http://localhost:8080> and sign in.

Logins are refused until a password is set, so the app fails closed rather than
running unprotected.

## Settings

`settings.json` holds non-secret configuration only, so it is safe to commit.

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

| Key | Meaning |
| --- | --- |
| `acceptedFiles` | Allowed file extensions, without the dot. |
| `maxFileSizeKb` | Maximum size of a stored image. |
| `maxUploadBodyKb` | Hard cap on the whole upload request (image + thumbnail, base64 encoded). |
| `port` | Listen port. The `PORT` environment variable wins over this. |
| `publicBaseUrl` | Origin used to build the permanent links stored in the database. Never taken from the request, so a spoofed `Host`/`Origin` cannot poison stored URLs. |
| `storagePath` | Folder under `public/` where images and thumbnails are written. |
| `metaFilePath` | The JSON file that holds the image records. |
| `maxSearchCount` | Maximum number of results returned by a search. |
| `showLastImages` | How many recent images the index page renders. |
| `thumbnailPattern` | Template for the forum code. `img-url` and `thumb-url` are placeholders and are replaced everywhere they appear. |
| `thumbnailWidth`, `thumbnailHeight` | Bounding box of the thumbnail generated in the browser. |

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

The new password is picked up on the next login; no restart is needed.

It is a single-user installation: the login form asks for a password only, and
there is no user name.

**Sessions.** The session is a signed cookie (`HttpOnly`, `Secure`,
`SameSite=Strict`, and `__Host-` prefixed when served over TLS). Live sessions
are tracked in `config/sessions.json`, so signing out actually revokes the token
on the server instead of only asking the browser to forget it. "Remember me"
issues a 30 day cookie that is renewed while you keep using the app.

**Which paths are public.** `/store/`, `/assets/` and `/favicon.ico` stay
public - that is exactly what makes the images hot-linkable. The index page and
all of `/api/` require a session.

## Security

The defaults are chosen for a small private installation that is exposed to the
internet behind a reverse proxy:

- **Passwords** are stored as scrypt hashes and compared in constant time.
- **Login throttling**: failures are counted per IP, with exponential lockout
  (5 failures, then 1 minute doubling up to 1 hour) and a delay on every failed
  attempt. A global brake stops distributed guessing.
- **CSRF**: `SameSite=Strict` cookies, plus an `Origin` check and a required
  `X-Requested-With` header on API calls, which a cross-site form cannot set.
- **XSS**: every piece of rendered metadata is HTML-escaped, and the
  Content-Security-Policy forbids inline scripts and styles outright.
- **Headers**: CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS.
- **Uploads** are capped by body size, must have an allowlisted extension and a
  conservative file name (no slashes, quotes, control characters or leading
  dots), must resolve inside the storage directory, must carry a matching
  magic-byte signature, and the thumbnail format must match the image format.
- **Storage** writes the database atomically (temp file, fsync, rename) and
  keeps the previous version as `meta.json.bak`; an unreadable file is
  quarantined rather than overwritten, never silently starting from empty.
- **Dependencies** are pinned by a committed lockfile, and `npm audit` is clean.

What this does not do: images under `/store/` are readable by anyone who knows
or guesses the URL. That is the point of an image host, but keep it in mind
before uploading anything private.

## Files and data

```
config/auth.json       password hash and session secret   (git-ignored, 600)
config/sessions.json   live sessions                      (git-ignored, 600)
db/meta.json           image records
db/meta.json.bak       previous good copy, used for recovery
public/store/          the images and their thumbnails
```

Back up `db/meta.json` and `public/store/` together - they must stay in sync.

## Behind a reverse proxy

The app speaks plain HTTP and expects a TLS terminator in front of it:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

- `X-Forwarded-Proto` makes the app issue `Secure`/`__Host-` cookies and send
  HSTS. Without it, sessions still work but are not marked secure.
- `trust proxy` is limited to loopback, so the proxy has to run on the same host
  for rate limiting to see the real client IP.
- Serving `/store/` and `/assets/` directly from nginx is optional (the app
  serves them too). If you do, a long cache lifetime is safe: asset URLs carry
  a `?v=` content hash, so a changed file is always a new URL.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Listen port, overrides `settings.json`. |
| `IMAGE_HOLDER_AUTH_FILE` | Path to the credentials file, instead of `config/auth.json`. Handy for a second instance or a throwaway test setup. |

## Powered by

Forex Software Ltd. at <https://forexsb.com/>

## Contributors

- [Vinicius Pereira](https://github.com/vinibpereira/)

## License

MIT License Copyright © 2012-present, Miroslav Popov
