"use strict";

const router = require("express").Router();
const auth = require("../auth");

router.get("/login", getLogin);
router.post("/login", auth.requireTrustedFormOrigin, postLogin);
router.post("/logout", auth.requireTrustedFormOrigin, postLogout);

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function getLogin(req, res) {
    if (req.session) {
        res.redirect(303, "./");
        return;
    }

    renderLogin(res, 200, "");
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function postLogin(req, res) {
    const ip = auth.clientIp(req);

    if (!auth.isConfigured()) {
        renderLogin(res, 503, "No password is configured. Run \"npm run set-password\" on the server, then restart.");
        return;
    }

    const limit = auth.checkLoginAllowed(ip);

    if (!limit.allowed) {
        const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
        res.setHeader("Retry-After", String(limit.retryAfterSeconds));
        renderLogin(res, 429, `Too many failed attempts. Try again in ${minutes} minute(s).`);
        return;
    }

    const password = typeof req.body.password === "string" ? req.body.password : "";
    const isPasswordValid = await auth.verifyPassword(password);

    if (!isPasswordValid) {
        auth.recordLoginFailure(ip);
        console.warn(`[auth] failed login from ${ip}`);

        // Uniform delay: makes online guessing and timing probes equally slow.
        await new Promise(resolve => setTimeout(resolve, 300));

        renderLogin(res, 401, "Wrong password.");
        return;
    }

    auth.recordLoginSuccess(ip);
    auth.startSession(res, req, req.body.remember === "on");
    console.log(`[auth] login from ${ip}`);

    res.redirect(303, "./");
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function postLogout(req, res) {
    auth.endSession(res, req);
    res.redirect(303, "login");
}

/**
 * @param {import("express").Response} res
 * @param {number} status
 * @param {string} error
 */
function renderLogin(res, status, error) {
    res.status(status);
    res.setHeader("Cache-Control", "no-store");
    res.render("login", {error: error, status: status});
}

module.exports = router;
