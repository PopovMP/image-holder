"use strict";

const express = require("express");
const router = express.Router();
const settings = require("../settings");
const dbManager = require("../db-manager");
const readHeader = require("./read-header");

router.post("/search", searchImage);

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function searchImage(req, res) {
    const header = readHeader(req, "SearchPhrase", {allowEmpty: true, maxLength: 200});

    if (header.error) {
        res.status(400).json({err: header.error, data: null});
        return;
    }

    const foundList = dbManager.find(header.value);
    const maxCount = Math.max(1, Number(settings.maxSearchCount) || 20);
    const startIndex = Math.max(foundList.length - maxCount, 0);
    const imageList = foundList.slice(startIndex, startIndex + maxCount);

    res.setHeader("Cache-Control", "no-store");
    res.json({err: null, data: imageList});
}

module.exports = router;
