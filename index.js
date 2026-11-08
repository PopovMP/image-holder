"use strict";

const http = require("http");
const path = require("path");
const express = require("express");
const morgan = require("morgan");

const settings = require("./settings");
const auth = require("./auth");
const assetVersion = require("./asset-version");
const apiDelete = require("./routes/api-delete");
const apiSearch = require("./routes/api-search");
const apiUpload = require("./routes/api-upload");
const viewsIndex = require("./routes/views-index");
const viewsLogin = require("./routes/views-login");

const port = Number(process.env.PORT) || settings.port;
const publicDir = path.join(__dirname, "public");

const SAFE_MESSAGES = {
    400: "Bad request.",
    401: "Unauthorized.",
    403: "Forbidden.",
    404: "Not found.",
    413: "Request body too large.",
    415: "Unsupported media type.",
    429: "Too many requests."
};

const app = express();

app.set("port", port);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// Cache-busting token for the stylesheet and scripts (see asset-version.js).
app.locals.assetVersion = assetVersion;

// Only trust X-Forwarded-* from the local nginx reverse proxy.
app.set("trust proxy", "loopback");

app.disable("x-powered-by");
app.disable("etag");

app.use(securityHeaders);
app.use(morgan("dev", {skip: morganSkip}));

// Static assets. Image files are served directly by nginx in production and
// stay publicly readable on purpose - they are hot-linked from forum posts.
app.use(express.static(publicDir, {
    dotfiles: "ignore",
    index: false,
    redirect: false,
    setHeaders: setStaticHeaders
}));

// Login form bodies. Everything else gets a per-route parser with a hard limit.
app.use(express.urlencoded({extended: false, limit: "16kb"}));

app.use(auth.attachSession);

// Public.
app.use("/", viewsLogin);

// Authenticated.
app.use("/", auth.requirePageAuth, viewsIndex);
app.use("/api", auth.requireApiAuth, auth.requireTrustedOrigin, apiSearch, apiUpload, apiDelete);

app.use(catchPageNotFound);
app.use(renderError);

const server = http.createServer(app);

server.on("error", onError);
server.on("listening", onListening);

if (require.main === module) {
    server.listen(port);
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

module.exports = app;

/**
 * Adds defence-in-depth response headers. CSP is strict: the client code is
 * all external, and the page model travels in a data attribute.
 * @type {import("express").RequestHandler}
 */
function securityHeaders(req, res, next) {
    const imgSrc = ["'self'", "data:", "blob:"];

    if (settings.publicBaseUrl) {
        try {
            imgSrc.push(new URL(settings.publicBaseUrl).origin);
        } catch (e) {
            /* ignore a malformed publicBaseUrl */
        }
    }

    res.setHeader("Content-Security-Policy", [
        "default-src 'self'",
        `img-src ${imgSrc.join(" ")}`,
        "script-src 'self'",
        "style-src 'self'",
        "font-src 'self'",
        "connect-src 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "object-src 'none'"
    ].join("; "));

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

    next();
}

/**
 * @param {import("express").Request} req
 * @return {boolean}
 */
function morganSkip(req) {
    return req.path.startsWith("/store/") || req.path.startsWith("/assets/");
}

/**
 * @param {import("http").ServerResponse} res
 * @param {string} filePath
 */
function setStaticHeaders(res, filePath) {
    if (filePath.startsWith(path.join(publicDir, settings.storagePath))) {
        res.setHeader("Cache-Control", "public, max-age=86400");
    } else {
        res.setHeader("Cache-Control", "public, max-age=3600");
    }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function catchPageNotFound(req, res) {
    if (req.path.startsWith("/api/")) {
        res.status(404).json({err: "Not found.", data: null});
        return;
    }

    res.status(404);
    res.type("text/plain").send("Resource not found!");
}

/**
 * Terminal error handler. Must declare four arguments, otherwise Express will
 * never treat it as an error handler.
 * @param {Error & {status?: number, statusCode?: number, type?: string}} err
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function renderError(err, req, res, next) {
    if (res.headersSent) {
        next(err);
        return;
    }

    const status = Number(err.status || err.statusCode) || 500;

    if (status >= 500) {
        console.error(`[error] ${req.method} ${req.originalUrl}: ${err.stack || err}`);
    } else if (status === 413) {
        console.warn(`[error] rejected oversized request to ${req.originalUrl}`);
    }

    // Never leak internal messages or stacks to the client.
    const message = SAFE_MESSAGES[status] || "Internal server error.";

    res.status(status);
    res.setHeader("Cache-Control", "no-store");

    if (req.path.startsWith("/api/")) {
        res.json({err: message, data: null});
        return;
    }

    res.type("text/plain").send(message);
}

/**
 * @param {NodeJS.ErrnoException} error
 */
function onError(error) {
    if (error.syscall !== "listen") {
        throw error;
    }

    switch (error.code) {
        case "EACCES":
            console.error(`${port} requires elevated privileges.`);
            process.exit(1);
            break;
        case "EADDRINUSE":
            console.error(`${port} is already in use.`);
            process.exit(1);
            break;
        default:
            throw error;
    }
}

function onListening() {
    const address = server.address();
    console.log(`Listening on port ${address.port}`);

    if (!auth.isConfigured()) {
        console.warn(`[auth] No credentials configured. Run "npm run set-password" - logins are refused until then.`);
    }
}

let isShuttingDown = false;

function shutdown(signal) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    console.log(`${signal} received, closing server.`);

    server.close(() => process.exit(0));

    setTimeout(() => process.exit(0), 10000).unref();
}
