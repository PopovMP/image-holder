"use strict";

/**
 * Content hash of the client assets, appended to their URLs as `?v=...`.
 *
 * nginx serves /assets/ with a one day cache, so without this a browser can
 * keep running yesterday's JavaScript against today's HTML. Because the hash
 * follows the file contents, any change produces a new URL and the stale copy
 * is never used again.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const FILES = [
    "public/assets/css/style.css",
    "public/assets/js/io-service.js",
    "public/assets/js/file-dropper.js",
    "public/assets/js/application-presenter.js",
    "public/assets/js/application.js"
];

/**
 * @return {string}
 */
function computeVersion() {
    const hash = crypto.createHash("sha256");

    for (const relativePath of FILES) {
        hash.update(relativePath);

        try {
            hash.update(fs.readFileSync(path.join(__dirname, relativePath)));
        } catch (e) {
            hash.update(`missing:${e.code || "error"}`);
        }
    }

    return hash.digest("hex").slice(0, 10);
}

module.exports = computeVersion();
