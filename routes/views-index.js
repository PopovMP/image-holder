"use strict";

const express = require("express");
const router = express.Router();
const settings = require("../settings");
const dbManager = require("../db-manager");

router.get("/", getIndex);

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function getIndex(req, res) {
    const imagesCount = dbManager.count();
    const maxShown = Math.max(1, Number(settings.showLastImages) || 20);
    const startIndex = Math.max(imagesCount - maxShown, 0);
    const preloadModel = dbManager.get(startIndex, imagesCount);

    const viewModel = {
        acceptedFiles: settings.acceptedFiles,
        maxFileSizeKb: settings.maxFileSizeKb,
        thumbnailPattern: settings.thumbnailPattern,
        thumbnailWidth: settings.thumbnailWidth,
        thumbnailHeight: settings.thumbnailHeight,
        preloadModel: preloadModel
    };

    // Page content is per-user and must never be cached by a proxy.
    res.setHeader("Cache-Control", "no-store");

    res.render("index", {
        viewModel: viewModel,
        appModel: JSON.stringify(viewModel)
    });
}

module.exports = router;
