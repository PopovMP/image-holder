"use strict";

const router = require("express").Router();
const settings = require("../settings");

router.get("/", function (req, res) {
    const viewModel = {
        acceptedFiles: settings.acceptedFiles,
        isPassCodeRequired: !!settings.passCode,
        maxFileSizeKb: settings.maxFileSizeKb
    }

    const appModel = {
        acceptedFiles: settings.acceptedFiles,
        isPassCodeRequired: !!settings.passCode,
        maxFileSizeKb: settings.maxFileSizeKb
    }

    const viewData = {
        viewModel: viewModel,
        appModel: JSON.stringify(appModel)
    };

    res.render("index", viewData);
});

module.exports = router;
