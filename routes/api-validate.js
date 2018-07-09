"use strict";

const router = require("express").Router();
const settings = require("../settings");

router.post("/validate", validatePassCode);

function validatePassCode(req, res) {
    const passCodeEncoded = req.header("PassCode");
    const passCode = decodeURIComponent(passCodeEncoded);

    const requiredPassCode = typeof settings.passCode === "string"
        ? settings.passCode
        : settings.passCode.toString();

    const isCodeValid = !settings.passCode || passCode === requiredPassCode;

    res.json({err: null, data: isCodeValid});
}

module.exports = router;
