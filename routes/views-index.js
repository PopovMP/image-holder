"use strict";

const router = require("express").Router();
const settings = require("../settings");
const dbManager = require("../db-manager");

router.get("/", getIndex);

function getIndex(req, res) {
    const imagesCount = dbManager.count();
    const startIndex = Math.max(imagesCount - settings.showLastImages, 0);
    const preloadModel = dbManager.get(startIndex, startIndex + imagesCount);

    const viewModel = {
        acceptedFiles: settings.acceptedFiles,
        isPassCodeRequired: !!settings.passCode,
        maxFileSizeKb: settings.maxFileSizeKb,
        thumbnailPattern: settings.thumbnailPattern,
        thumbnailWidth: settings.thumbnailWidth,
        thumbnailHeight: settings.thumbnailHeight,
        preloadModel: preloadModel
    };

    const viewData = {
        viewModel: viewModel,
        appModel: JSON.stringify(viewModel)
    };

    res.render("index", viewData);
}

module.exports = router;
