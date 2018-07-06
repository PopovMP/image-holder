"use strict";

const path = require("path");
const router = require("express").Router();
const settings = require("../settings");
const fileUpload = require("../file-upload");

router.post("/upload", uploadDataFile);

function uploadDataFile(req, res) {
    const fileNameEncoded = req.header("FileName");
    const passCodeEncoded = req.header("PassCode");

    const fileNameDecoded = decodeURIComponent(fileNameEncoded);
    const fileName = path.basename(fileNameDecoded);
    const passCode = decodeURIComponent(passCodeEncoded);

    const requiredPassCode = typeof settings.passCode === "string"
        ? settings.passCode
        : settings.passCode.toString();

    if (!fileName) {
        res.json({ err: "Wrong file name!", data: null });
        return;
    }

    if (passCode !== requiredPassCode) {
        res.json({ err: "Wrong pass code!", data: null });
        return;
    }

    let fileContent = "";
    req.on("data", chunk => fileContent += chunk);
    req.on("end", req_end);

    function req_end() {
        if (fileContent) {
            const host = encodeURIComponent(req.headers.origin);
            fileUpload.saveFile(fileName, fileContent, host, fileUpload_ready);
        } else {
            res.json({ err: "Error with receiving content!", data: null });
        }
    }

    function fileUpload_ready(err, data) {
        res.json({ err: err, data: data });
    }
}

module.exports = router;
