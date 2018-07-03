"use strict";

const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const settings = require("./settings");

router.post("/upload", uploadDataFile);

function uploadDataFile(req, res) {
    const fileNameEncoded = req.header("FileName");
    const passCodeEncoded = req.header("PassCode");

    const fileName = decodeURIComponent(fileNameEncoded);
    const passCode = decodeURIComponent(passCodeEncoded);

    const requiredPassCode = typeof settings.passCode === "string"
        ? settings.passCode
        : settings.passCode.toString();

    if (!fileName) {
        res.json({err: "Wrong file name!", data: null});
        return;
    }

    if (passCode !== requiredPassCode) {
        res.json({err: "Wrong pass code!", data: null});
        return;
    }

    const filePath = path.join(__dirname, "public", settings.storagePath, fileName);

    console.log(filePath);

    const host = encodeURIComponent(req.headers.origin);
    const fileUrl = path.join(host, settings.storagePath, fileName);

    let content = "";
    req.on("data", chunk => content += chunk);
    req.on("end", req_end);

    function req_end() {
        if (content) {
            const data = content.replace(/^data:image\/\w+;base64,/, "");
            const buffer = new Buffer(data, "base64");
            fs.writeFile(filePath, buffer, fs_writeFile_ready);
        } else {
            res.json({err: "Error with receiving content!", data: null});
        }
    }

    function fs_writeFile_ready(err) {
        if (err) {
            res.json({err: err, data: null});
        } else {
            res.json({err: null, data: fileUrl});
        }
    }
}

module.exports = router;
