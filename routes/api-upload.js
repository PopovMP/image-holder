"use strict";

const path = require("path");
const router = require("express").Router();
const settings = require("../settings");
const fileManager = require("../file-manager");

router.post("/upload", uploadImage);

function uploadImage(req, res) {
    const fileNameEncoded = req.header("FileName");
    const passCodeEncoded = req.header("PassCode");
    const isForceUpload = req.header("ForceUpload").toLowerCase() === "true";

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

    let uploadData = "";
    req.on("data", chunk => uploadData += chunk);
    req.on("end", req_end);

    function req_end() {
        try {
            const data = JSON.parse(uploadData);
            if (data.image && data.thumbnail) {
                const host = encodeURIComponent(req.headers.origin);
                fileManager.saveFile(fileName, data.image, data.thumbnail, isForceUpload, host, fileUpload_ready);
            } else {
                res.json({err: "Error with receiving content!", data: null});
            }
        } catch (e) {
            res.json({err: e, data: null});
        }
    }

    function fileUpload_ready(err, data) {
        res.json({err: err, data: data});
    }
}

module.exports = router;
