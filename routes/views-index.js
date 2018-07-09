"use strict";

const router = require("express").Router();
const settings = require("../settings");
const dbManager = require("../db-manager");

router.get("/", function (req, res) {
    const preloadModel = dbManager.get(0, settings.showLastImages);

    const viewModel = {
        acceptedFiles: settings.acceptedFiles,
        isPassCodeRequired: !!settings.passCode,
        maxFileSizeKb: settings.maxFileSizeKb,
        preloadModel: preloadModel
    };

    const viewData = {
        viewModel: viewModel,
        appModel: JSON.stringify(viewModel)
    };

    res.render("index", viewData);
});

module.exports = router;
