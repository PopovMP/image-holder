"use strict";

const http = require("http");
const path = require("path");
const express = require("express");
const favicon = require("serve-favicon");
const morgan = require("morgan");
const bodyParser = require("body-parser");

const settings = require("./settings");
const fileUpload = require("./file-upload");

const port = settings.port;

const app = express();
app.set("port", port);
app.disable("x-powered-by");

app.use(favicon(path.join(__dirname, "public", "favicon.ico")));
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({extended: false}));

app.use("/api", fileUpload);

app.use("/test", function (req, res) {
    res.send("ok");
});

app.use(catchPageNotFound);
app.use(renderError);

const server = http.createServer(app);
server.on("error", onError);
server.on("listening", onListening);
server.listen(port);

function catchPageNotFound(req, res) {
    res.status(404);
    res.end("Resource not found!");
}

function renderError(err, req, res) {
    const message = `${err.message}: ${err.status}`;
    res.status(err.status || 500);
    res.end(message);
}

function onError(error) {
    if (error.syscall !== "listen") throw error;

    switch (error.code) {
        case "EACCES":
            console.error(`${port} requires elevated privileges.`);
            process.exit(1);
            break;
        case "EADDRINUSE":
            console.error(`${port} is already in use.`);
            process.exit(1);
            break;
        default:
            throw error;
    }
}

function onListening() {
    const address = server.address();
    const message = "Listening on port " + address.port;
    console.log(message);
}
