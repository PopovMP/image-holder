"use strict";

const path = require("path");
const router = require("express").Router();
const settings = require("../settings");
const fileManager = require("../file-manager");

router.post("/delete", deleteImage);

function deleteImage(req, res) {
    const fileNameEncoded = req.header("FileName");
    const passCodeEncoded = req.header("PassCode");

    const fileNameDecoded = decodeURIComponent(fileNameEncoded);
    const fileName = path.basename(fileNameDecoded);
    const passCode = decodeURIComponent(passCodeEncoded);

    if (!fileName) {
        res.json({err: "Wrong file name!", data: null});
        return;
    }

    const requiredPassCode = typeof settings.passCode === "string"
        ? settings.passCode
        : settings.passCode.toString();

    const isCodeValid = !settings.passCode || passCode === requiredPassCode;

    if (!isCodeValid) {
        res.json({err: "Wrong pass code!", data: null});
        return;
    }

    fileManager.deleteFile(fileName, deleteFile_ready);


    function deleteFile_ready(err, data) {
        res.json({err: err, data: data});
    }
}

module.exports = router;
