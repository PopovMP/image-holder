"use strict";

const router = require("express").Router();
const settings = require("../settings");
const dbManager = require("../db-manager");

router.post("/search", searchImage);

function searchImage(req, res) {
    const phraseEncoded = req.header("SearchPhrase");

    const phrase = decodeURIComponent(phraseEncoded);
    const imageList = dbManager.find(phrase, 0, settings.maxSearchCount);

    res.json({err: null, data: imageList});
}

module.exports = router;
