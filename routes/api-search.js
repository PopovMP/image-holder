"use strict";

const router = require("express").Router();
const settings = require("../settings");
const dbManager = require("../db-manager");

router.post("/search", searchImage);

function searchImage(req, res) {
    const phraseEncoded = req.header("SearchPhrase");
    const phrase = decodeURIComponent(phraseEncoded);
    const foundList = dbManager.find(phrase);
    const startIndex = Math.max(foundList.length - settings.maxSearchCount, 0);
    const imageList = foundList.slice(startIndex, startIndex + settings.maxSearchCount);

    res.json({err: null, data: imageList});
}

module.exports = router;
