"use strict";

const path = require("path");
const express = require("express");
const router = express.Router();
const fileManager = require("../file-manager");
const readHeader = require("./read-header");

router.post("/delete", deleteImage);

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function deleteImage(req, res) {
    const header = readHeader(req, "FileName");

    if (header.error) {
        res.status(400).json({err: header.error, data: null});
        return;
    }

    const fileName = path.basename(String(header.value));

    if (!fileName) {
        res.status(400).json({err: "Wrong file name!", data: null});
        return;
    }

    fileManager.deleteFile(fileName, (err, data) => {
        if (err) {
            res.status(400).json({err: err, data: null});
            return;
        }

        res.json({err: null, data: data});
    });
}

module.exports = router;
