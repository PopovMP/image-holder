"use strict";

const express = require("express");
const router = express.Router();
const settings = require("../settings");
const fileManager = require("../file-manager");
const readHeader = require("./read-header");

// Hard ceiling on the request body: base64 image + base64 thumbnail, plus JSON
// overhead. Without this a single request could exhaust the process memory.
const bodyLimit = `${Number(settings.maxUploadBodyKb) || 4096}kb`;
const jsonParser = express.json({limit: bodyLimit});

router.post("/upload", jsonParser, uploadImage);

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function uploadImage(req, res) {
    if (!req.is("application/json")) {
        res.status(415).json({err: "Expected an application/json body.", data: null});
        return;
    }

    const header = readHeader(req, "FileName");

    if (header.error) {
        res.status(400).json({err: header.error, data: null});
        return;
    }

    const fileName = String(header.value);
    const isForceUpload = String(req.get("ForceUpload") || "").toLowerCase() === "true";
    const body = req.body || {};

    if (typeof body.image !== "string" || typeof body.thumbnail !== "string") {
        res.status(400).json({err: "Error with receiving content!", data: null});
        return;
    }

    fileManager.saveFile(fileName, body.image, body.thumbnail, isForceUpload, (err, data) => {
        if (err) {
            res.status(400).json({err: err, data: null});
            return;
        }

        res.json({err: null, data: data});
    });
}

module.exports = router;
