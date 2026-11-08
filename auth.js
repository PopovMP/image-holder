"use strict";

/**
 * Authentication for a single-user installation.
 *
 * - Credentials live in a git-ignored config file as a scrypt hash.
 * - Sessions are stateless, signed cookies (HMAC-SHA256). No session store.
 * - Login attempts are rate limited per IP with exponential lockout.
 *
 * Nothing here depends on any third-party package.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const settings = require("./settings");

const AUTH_FILE = process.env.IMAGE_HOLDER_AUTH_FILE
    || path.join(__dirname, "config", "auth.json");

// Tracks live sessions so that "sign out" really revokes a token instead of
// only asking the browser to forget it. Keyed by sha256 of the token.
const SESSIONS_FILE = path.join(path.dirname(AUTH_FILE), "sessions.json");
const MAX_SESSIONS = 50;

const COOKIE_SECURE_NAME = "__Host-ih_session";
const COOKIE_PLAIN_NAME = "ih_session";

const SESSION_HOURS_DEFAULT = 12;
const REMEMBER_DAYS_DEFAULT = 30;

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_MS = 60 * 60 * 1000;
const RECORD_TTL_MS = 24 * 60 * 60 * 1000;

/** @type {{passwordHash: string, sessionSecret: string, sessionVersion: number, sessionHours: number, rememberDays: number}|null} */
let cachedConfig = null;
let cachedMtime = -1;

/* ------------------------------------------------------------------ config */

/**
 * Reads and validates the auth config. Reloads when the file changes, so
 * `npm run set-password` takes effect without a restart.
 * @return {object|null}
 */
function loadConfig() {
    let stat;

    try {
        stat = fs.statSync(AUTH_FILE);
    } catch (e) {
        cachedConfig = null;
        cachedMtime = -1;
        return null;
    }

    if (cachedConfig && stat.mtimeMs === cachedMtime) {
        return cachedConfig;
    }

    let raw;

    try {
        raw = fs.readFileSync(AUTH_FILE, "utf8");
    } catch (e) {
        cachedConfig = null;
        cachedMtime = -1;
        return null;
    }

    let parsed;

    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        console.error(`[auth] ${AUTH_FILE} is not valid JSON: ${e.message}`);
        cachedConfig = null;
        cachedMtime = -1;
        return null;
    }

    const config = {
        passwordHash: typeof parsed.passwordHash === "string" ? parsed.passwordHash : "",
        sessionSecret: typeof parsed.sessionSecret === "string" ? parsed.sessionSecret : "",
        sessionVersion: Number.isInteger(parsed.sessionVersion) ? parsed.sessionVersion : 0,
        sessionHours: Number.isFinite(parsed.sessionHours) && parsed.sessionHours > 0
            ? parsed.sessionHours
            : SESSION_HOURS_DEFAULT,
        rememberDays: Number.isFinite(parsed.rememberDays) && parsed.rememberDays > 0
            ? parsed.rememberDays
            : REMEMBER_DAYS_DEFAULT
    };

    if (config.sessionSecret.length < 32) {
        console.error("[auth] sessionSecret is missing or too short (need 32+ chars).");
        config.sessionSecret = "";
    }

    cachedConfig = config;
    cachedMtime = stat.mtimeMs;

    return config;
}

/**
 * @return {boolean} true when a password and a session secret are configured.
 */
function isConfigured() {
    const config = loadConfig();
    return Boolean(config && config.passwordHash && config.sessionSecret);
}

/* ------------------------------------------------------------------ hashing */

/**
 * @param {string} password
 * @param {Buffer} salt
 * @param {number} keylen
 * @param {{N: number, r: number, p: number}} params
 * @return {Promise<Buffer>}
 */
function deriveKey(password, salt, keylen, params) {
    const {N, r, p} = params;
    const maxmem = 128 * N * r * 2 + 1024 * 1024;

    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, keylen, {N: N, r: r, p: p, maxmem: maxmem}, (err, key) => {
            if (err) {
                reject(err);
            } else {
                resolve(key);
            }
        });
    });
}

/**
 * Encodes a password hash in the form `scrypt$N$r$p$salt$hash`.
 * @param {string} password
 * @param {{N: number, r: number, p: number, keylen: number}} [options]
 * @return {Promise<string>}
 */
async function hashPassword(password, options) {
    const params = Object.assign({N: 16384, r: 8, p: 1, keylen: 32}, options);
    const salt = crypto.randomBytes(16);
    const key = await deriveKey(password, salt, params.keylen, params);

    return [
        "scrypt",
        params.N,
        params.r,
        params.p,
        salt.toString("base64"),
        key.toString("base64")
    ].join("$");
}

/**
 * Verifies a password against a stored `scrypt$...` hash in constant time.
 * @param {string} password
 * @param {string} storedHash
 * @return {Promise<boolean>}
 */
async function verifyHash(password, storedHash) {
    const parts = String(storedHash).split("$");

    if (parts.length !== 6 || parts[0] !== "scrypt") {
        return false;
    }

    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);

    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
        return false;
    }

    // Guard against a hostile or corrupted config exhausting memory.
    if (N < 1024 || N > 1048576 || r < 1 || r > 64 || p < 1 || p > 16) {
        return false;
    }

    let salt;
    let expected;

    try {
        salt = Buffer.from(parts[4], "base64");
        expected = Buffer.from(parts[5], "base64");
    } catch (e) {
        return false;
    }

    if (salt.length === 0 || expected.length === 0) {
        return false;
    }

    let actual;

    try {
        actual = await deriveKey(password, salt, expected.length, {N: N, r: r, p: p});
    } catch (e) {
        return false;
    }

    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/**
 * Verifies the login password. Always fails fast when nothing is configured.
 * @param {string} password
 * @return {Promise<boolean>}
 */
async function verifyPassword(password) {
    const config = loadConfig();

    if (!config || !config.passwordHash || !config.sessionSecret) {
        return false;
    }

    if (typeof password !== "string" || password.length === 0 || password.length > 1024) {
        return false;
    }

    return verifyHash(password, config.passwordHash);
}

/* -------------------------------------------------------------- login limits */

/** @type {Map<string, {count: number, firstAt: number, lockUntil: number, level: number}>} */
const failures = new Map();

/** timestamps of recent failures, for the global brake */
let globalFailures = [];

/**
 * @param {string} ip
 * @return {{allowed: boolean, retryAfterSeconds: number}}
 */
function checkLoginAllowed(ip) {
    const now = Date.now();
    const record = failures.get(ip);

    if (record && record.lockUntil > now) {
        return {
            allowed: false,
            retryAfterSeconds: Math.ceil((record.lockUntil - now) / 1000)
        };
    }

    const globalLevel = globalBrakeLevel(now);

    if (globalLevel > 0) {
        return {allowed: false, retryAfterSeconds: globalLevel};
    }

    return {allowed: true, retryAfterSeconds: 0};
}

/**
 * Global brake: too many failures from anywhere in the last hour.
 * @param {number} now
 * @return {number} seconds to wait, 0 when not tripped
 */
function globalBrakeLevel(now) {
    globalFailures = globalFailures.filter(t => now - t < 60 * 60 * 1000);

    if (globalFailures.length >= 100) {
        return 600;
    }

    return 0;
}

/**
 * @param {string} ip
 */
function recordLoginFailure(ip) {
    const now = Date.now();
    let record = failures.get(ip);

    if (!record || now - record.firstAt > FAILURE_WINDOW_MS) {
        record = {count: 0, firstAt: now, lockUntil: 0, level: 0};
        failures.set(ip, record);
    }

    record.count += 1;
    globalFailures.push(now);

    if (record.count >= MAX_FAILURES) {
        record.level += 1;
        record.lockUntil = now + Math.min(BASE_LOCK_MS * Math.pow(2, record.level - 1), MAX_LOCK_MS);
        record.count = 0;
        record.firstAt = now;
    }

    pruneFailures(now);
}

/**
 * @param {string} ip
 */
function recordLoginSuccess(ip) {
    failures.delete(ip);
    globalFailures = [];
}

/**
 * @param {number} now
 */
function pruneFailures(now) {
    if (failures.size < 256) {
        return;
    }

    for (const [key, record] of failures) {
        if (now - record.firstAt > RECORD_TTL_MS) {
            failures.delete(key);
        }
    }
}

/* ------------------------------------------------------------- session store */

/** @type {Map<string, {exp: number, remember: boolean, created: number}>|null} */
let sessions = null;

/**
 * @param {string} token
 * @return {string}
 */
function tokenId(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * @return {Map<string, {exp: number, remember: boolean, created: number}>}
 */
function loadSessions() {
    if (sessions) {
        return sessions;
    }

    sessions = new Map();

    try {
        const raw = fs.readFileSync(SESSIONS_FILE, "utf8");
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
            for (const record of parsed) {
                if (record && typeof record.id === "string" && typeof record.exp === "number") {
                    sessions.set(record.id, record);
                }
            }
        }
    } catch (e) {
        if (e.code !== "ENOENT") {
            console.warn(`[auth] Ignoring unreadable ${SESSIONS_FILE}: ${e.message}`);
        }
    }

    pruneSessions(Date.now());

    return sessions;
}

/**
 * @param {number} now
 */
function pruneSessions(now) {
    if (!sessions) {
        return;
    }

    for (const [id, record] of sessions) {
        if (!(record.exp > now)) {
            sessions.delete(id);
        }
    }
}

/**
 * Writes the session registry atomically. A failure is loud but not fatal: the
 * in-memory copy still authenticates, only revocation across restarts is lost.
 */
function saveSessions() {
    if (!sessions) {
        return;
    }

    pruneSessions(Date.now());

    // Keep the oldest-first window bounded so the file cannot grow forever.
    if (sessions.size > MAX_SESSIONS) {
        const sorted = [...sessions.entries()].sort((a, b) => a[1].created - b[1].created);

        for (const [id] of sorted.slice(0, sessions.size - MAX_SESSIONS)) {
            sessions.delete(id);
        }
    }

    const tmpPath = `${SESSIONS_FILE}.tmp`;
    const payload = JSON.stringify([...sessions.entries()].map(([id, record]) => ({
        id: id,
        exp: record.exp,
        remember: record.remember,
        created: record.created
    })));

    try {
        fs.mkdirSync(path.dirname(SESSIONS_FILE), {recursive: true, mode: 0o700});
        fs.writeFileSync(tmpPath, payload, {mode: 0o600});
        fs.chmodSync(tmpPath, 0o600);
        fs.renameSync(tmpPath, SESSIONS_FILE);
    } catch (e) {
        console.error(`[auth] Could not persist sessions: ${e.message}`);
    }
}

/**
 * @param {string} token
 * @param {{exp: number, remember: boolean, iat: number}} payload
 */
function registerSession(token, payload) {
    const registry = loadSessions();

    registry.set(tokenId(token), {
        exp: payload.exp,
        remember: Boolean(payload.remember),
        created: payload.iat || Date.now()
    });

    saveSessions();
}

/**
 * @param {string} token
 */
function unregisterSession(token) {
    if (!token) {
        return;
    }

    const registry = loadSessions();

    if (registry.delete(tokenId(token))) {
        saveSessions();
    }
}

/**
 * Removes every session, e.g. after a credential change.
 */
function unregisterAllSessions() {
    loadSessions().clear();
    saveSessions();
}

/* ------------------------------------------------------------------ cookies */

/**
 * @param {string} header
 * @return {Object<string, string>}
 */
function parseCookies(header) {
    const result = Object.create(null);

    if (typeof header !== "string" || header.length === 0) {
        return result;
    }

    for (const pair of header.split(";")) {
        const index = pair.indexOf("=");

        if (index < 1) {
            continue;
        }

        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();

        if (name && !(name in result)) {
            result[name] = value;
        }
    }

    return result;
}

/**
 * @param {import("http").IncomingMessage} req
 * @return {string}
 */
function clientIp(req) {
    return req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
}

/**
 * @param {import("http").IncomingMessage} req
 * @return {boolean}
 */
function isSecureRequest(req) {
    if (req.secure) {
        return true;
    }

    const forwarded = req.headers["x-forwarded-proto"];

    return typeof forwarded === "string" && forwarded.split(",")[0].trim() === "https";
}

/**
 * @param {string} name
 * @param {string} value
 * @param {{maxAge?: number, secure: boolean}} options
 * @return {string}
 */
function serializeCookie(name, value, options) {
    const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict"];

    if (options.secure) {
        parts.push("Secure");
    }

    if (typeof options.maxAge === "number") {
        parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
    }

    return parts.join("; ");
}

/* ------------------------------------------------------------------- tokens */

/**
 * @param {string} data
 * @return {Buffer}
 */
function sign(data) {
    const config = loadConfig();

    if (!config || !config.sessionSecret) {
        throw new Error("Auth is not configured.");
    }

    return crypto.createHmac("sha256", config.sessionSecret).update(data).digest();
}

/**
 * @param {{exp: number, rv: number, remember: boolean}} payload
 * @return {string}
 */
function createToken(payload) {
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const mac = sign(body).toString("base64url");

    return `${body}.${mac}`;
}

/**
 * @param {string} token
 * @return {{exp: number, rv: number, remember: boolean, iat: number}|null}
 */
function verifyToken(token) {
    const config = loadConfig();

    if (!config || !config.sessionSecret) {
        return null;
    }

    if (typeof token !== "string" || token.length === 0 || token.length > 512) {
        return null;
    }

    const separator = token.indexOf(".");

    if (separator < 1) {
        return null;
    }

    const body = token.slice(0, separator);
    const providedMac = Buffer.from(token.slice(separator + 1), "base64url");
    const expectedMac = sign(body);

    if (providedMac.length !== expectedMac.length) {
        return null;
    }

    if (!crypto.timingSafeEqual(providedMac, expectedMac)) {
        return null;
    }

    let payload;

    try {
        payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch (e) {
        return null;
    }

    if (!payload || typeof payload.exp !== "number" || payload.exp <= Date.now()) {
        return null;
    }

    if (payload.rv !== config.sessionVersion) {
        return null;
    }

    // A token that is not in the registry has been signed out.
    const record = loadSessions().get(tokenId(token));

    if (!record || !(record.exp > Date.now())) {
        return null;
    }

    return payload;
}

/**
 * @param {import("http").IncomingMessage} req
 * @return {string}
 */
function readToken(req) {
    const cookies = parseCookies(req.headers.cookie);

    return cookies[COOKIE_SECURE_NAME] || cookies[COOKIE_PLAIN_NAME] || "";
}

/**
 * Issues a session cookie.
 * @param {import("http").ServerResponse} res
 * @param {import("http").IncomingMessage} req
 * @param {boolean} remember
 */
function startSession(res, req, remember, previousToken) {
    const config = loadConfig();
    const secure = isSecureRequest(req);
    const name = secure ? COOKIE_SECURE_NAME : COOKIE_PLAIN_NAME;
    const lifetimeSeconds = remember
        ? Math.floor(config.rememberDays * 24 * 60 * 60)
        : Math.floor(config.sessionHours * 60 * 60);

    const now = Date.now();
    const payload = {
        iat: now,
        exp: now + lifetimeSeconds * 1000,
        rv: config.sessionVersion,
        remember: Boolean(remember)
    };

    const token = createToken(payload);

    registerSession(token, payload);

    if (previousToken) {
        unregisterSession(previousToken);
    }

    res.setHeader("Set-Cookie", serializeCookie(name, token, {
        maxAge: remember ? lifetimeSeconds : undefined,
        secure: secure
    }));
}

/**
 * @param {import("http").ServerResponse} res
 * @param {import("http").IncomingMessage} req
 */
function endSession(res, req) {
    unregisterSession(readToken(req));

    res.setHeader("Set-Cookie", [
        serializeCookie(COOKIE_SECURE_NAME, "", {maxAge: 0, secure: true}),
        serializeCookie(COOKIE_PLAIN_NAME, "", {maxAge: 0, secure: false})
    ]);
}

/* --------------------------------------------------------------- middleware */

/**
 * Populates `req.session`. Extends long-lived "remember me" cookies while the
 * user stays active, so a daily visitor never has to log in again.
 * @type {import("express").RequestHandler}
 */
function attachSession(req, res, next) {
    req.session = null;

    const token = readToken(req);
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
        next();
        return;
    }

    req.session = payload;

    const config = loadConfig();

    if (payload.remember && config) {
        const total = config.rememberDays * 24 * 60 * 60 * 1000;
        const remaining = payload.exp - Date.now();

        if (remaining < total / 2) {
            startSession(res, req, true, token);
        }
    }

    next();
}

/**
 * @param {import("express").Request} req
 * @return {boolean}
 */
function wantsJson(req) {
    if (req.path.startsWith("/api")) {
        return true;
    }

    if (req.headers["x-requested-with"] === "XMLHttpRequest") {
        return true;
    }

    const accept = req.headers.accept;

    return typeof accept === "string" && accept.includes("application/json");
}

/**
 * @type {import("express").RequestHandler}
 */
function requirePageAuth(req, res, next) {
    if (req.session) {
        next();
        return;
    }

    req.session = null;
    res.status(401);
    res.setHeader("Cache-Control", "no-store");

    if (wantsJson(req)) {
        res.json({err: "Unauthorized", data: null});
        return;
    }

    res.render("login", {error: "", status: 401});
}

/**
 * API flavour: always answers with JSON, never redirects.
 * @type {import("express").RequestHandler}
 */
function requireApiAuth(req, res, next) {
    if (req.session) {
        next();
        return;
    }

    res.status(401);
    res.setHeader("Cache-Control", "no-store");
    res.json({err: "Unauthorized", data: null});
}

/**
 * Hostnames this installation legitimately answers on. The Host header is
 * included because it always matches the address the browser used, whatever
 * that is (alternate domain, port, path-based proxy).
 * @param {import("express").Request} req
 * @return {string[]}
 */
function expectedHosts(req) {
    const hosts = [];
    const headerHost = req.headers.host;

    if (typeof headerHost === "string" && headerHost.length > 0) {
        hosts.push(headerHost.toLowerCase());
    }

    if (settings.publicBaseUrl) {
        try {
            hosts.push(new URL(settings.publicBaseUrl).host.toLowerCase());
        } catch (e) {
            /* ignore a malformed publicBaseUrl */
        }
    }

    return hosts;
}

/**
 * @param {string|undefined} origin
 * @return {string|null} the origin host, or null when it is opaque/absent
 */
function originHost(origin) {
    if (typeof origin !== "string") {
        return null;
    }

    const value = origin.trim();

    // Browsers send `Origin: null` for an opaque origin (sandboxed context,
    // file://, a redirect that suppressed the origin, some privacy tools).
    // That means "unknown", not "hostile".
    if (value.length === 0 || value.toLowerCase() === "null") {
        return null;
    }

    try {
        const url = new URL(value);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }

        return url.host.toLowerCase();
    } catch (e) {
        return null;
    }
}

/**
 * @param {import("express").Request} req
 * @return {boolean|null} true when trusted, false when definitely foreign,
 *                        null when the origin is unknown/opaque
 */
function isOriginTrusted(req) {
    const host = originHost(req.headers.origin);

    if (host === null) {
        return null;
    }

    return expectedHosts(req).includes(host);
}

/**
 * @param {import("express").Request} req
 * @param {string} path
 */
function logRejection(req, path) {
    const expected = expectedHosts(req).join(", ") || "(none)";
    console.warn(`[auth] rejected cross-origin POST ${path}: Origin "${req.headers.origin}", expected host ${expected}`);
}

/**
 * Second line of defence behind SameSite=Strict: reject state-changing
 * requests whose Origin is foreign, and require a custom header from
 * clients that send no Origin at all (cross-site forms cannot set one).
 * @type {import("express").RequestHandler}
 */
function requireTrustedOrigin(req, res, next) {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
        next();
        return;
    }

    const trusted = isOriginTrusted(req);

    if (trusted === true) {
        next();
        return;
    }

    if (trusted === false) {
        logRejection(req, req.originalUrl);
        res.status(403);
        res.json({err: "Cross-origin request rejected.", data: null});
        return;
    }

    // Unknown origin: a cross-site form cannot set a custom header, so this
    // still proves the call came from our own script.
    if (req.headers["x-requested-with"] === "XMLHttpRequest") {
        next();
        return;
    }

    logRejection(req, req.originalUrl);
    res.status(403);
    res.json({err: "Missing request header.", data: null});
}

/**
 * Same check for plain HTML form posts (sign in, sign out), where the client
 * cannot send a custom header and an unknown origin must be tolerated: a
 * browser stuck on `Origin: null` would otherwise be locked out for good.
 *
 * Safety does not rest on this check. The sign-in form needs no session and
 * issues a cookie only for a correct password, and every state-changing call
 * behind a session is protected by SameSite=Strict.
 * @type {import("express").RequestHandler}
 */
function requireTrustedFormOrigin(req, res, next) {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
        next();
        return;
    }

    if (isOriginTrusted(req) === false) {
        logRejection(req, req.originalUrl);
        res.status(403);
        res.type("text/plain").send("Cross-origin request rejected. Open the app directly at its own address and try again.");
        return;
    }

    next();
}

module.exports = {
    AUTH_FILE: AUTH_FILE,
    attachSession: attachSession,
    checkLoginAllowed: checkLoginAllowed,
    clientIp: clientIp,
    endSession: endSession,
    hashPassword: hashPassword,
    isConfigured: isConfigured,
    loadConfig: loadConfig,
    recordLoginFailure: recordLoginFailure,
    recordLoginSuccess: recordLoginSuccess,
    requireApiAuth: requireApiAuth,
    requirePageAuth: requirePageAuth,
    requireTrustedFormOrigin: requireTrustedFormOrigin,
    requireTrustedOrigin: requireTrustedOrigin,
    unregisterAllSessions: unregisterAllSessions,
    startSession: startSession,
    verifyPassword: verifyPassword
};
