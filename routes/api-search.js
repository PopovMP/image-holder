"use strict";

const path = require("path");
const router = require("express").Router();
const settings = require("../settings");
const dbManager = require("../db-manager");

router.post("/search", searchImage);

function searchImage(req, res) {
    const phraseEncoded = req.header("SearchPhrase");
    const passCodeEncoded = req.header("PassCode");

    const phrase = decodeURIComponent(phraseEncoded);
    const passCode = decodeURIComponent(passCodeEncoded);

    const requiredPassCode = typeof settings.passCode === "string"
        ? settings.passCode
        : settings.passCode.toString();

    if (passCode !== requiredPassCode) {
        res.json({err: "Wrong pass code!", data: null});
        return;
    }

    const imageList = dbManager.find(phrase, 0, settings.maxSearchCount);

    res.json({err: null, data: imageList});

}

module.exports = router;
