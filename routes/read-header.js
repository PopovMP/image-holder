"use strict";

/**
 * Reads a percent-encoded request header, rejecting anything malformed instead
 * of silently turning it into the string "undefined".
 * @param {import("express").Request} req
 * @param {string} name
 * @param {{allowEmpty?: boolean, maxLength?: number}} [options]
 * @return {{value?: string, error?: string}}
 */
function readHeader(req, name, options) {
    const settings = Object.assign({allowEmpty: false, maxLength: 512}, options);
    const raw = req.get(name);

    if (typeof raw !== "string") {
        return settings.allowEmpty
            ? {value: ""}
            : {error: `${name} header is missing.`};
    }

    if (raw.length > settings.maxLength) {
        return {error: `${name} header is too long.`};
    }

    if (raw.length === 0) {
        return settings.allowEmpty
            ? {value: ""}
            : {error: `${name} header is empty.`};
    }

    let value;

    try {
        value = decodeURIComponent(raw);
    } catch (e) {
        return {error: `${name} header is malformed.`};
    }

    if (value.length === 0 && !settings.allowEmpty) {
        return {error: `${name} header is empty.`};
    }

    return {value: value};
}

module.exports = readHeader;
