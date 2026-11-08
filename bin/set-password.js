#!/usr/bin/env node
"use strict";

/**
 * Sets the login password for Image Holder.
 *
 *   npm run set-password              # prompt for a password
 *   npm run set-password -- --generate # generate a random one
 *   npm run set-password -- --rotate-secret  # also log out every device
 *
 * Only a scrypt hash is written to disk. The plain password never is.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const auth = require("../auth");
const AUTH_FILE = auth.AUTH_FILE;
const MIN_LENGTH = 10;

// Keeps unread input between prompts so pasted answers are not lost.
let inputBuffer = "";

main().catch(error => {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
});

async function main() {
    const args = new Set(process.argv.slice(2));
    const existing = readExisting();

    let password;

    if (args.has("--generate")) {
        password = generatePassword();
    } else {
        console.log(`\nImage Holder - set the login password`);
        console.log(`File: ${AUTH_FILE}`);
        console.log(`Only a scrypt hash is stored. Input is hidden, Enter to confirm.\n`);

        password = await askPassword(`New password (min ${MIN_LENGTH} characters): `);

        if (password.length < MIN_LENGTH) {
            throw new Error(`The password must be at least ${MIN_LENGTH} characters long.`);
        }

        const confirmation = await askPassword("Repeat password: ");

        if (password !== confirmation) {
            throw new Error("The passwords do not match.");
        }
    }

    const passwordHash = await auth.hashPassword(password);
    const sessionSecret = args.has("--rotate-secret") || !existing.sessionSecret
        ? crypto.randomBytes(32).toString("hex")
        : existing.sessionSecret;

    const config = {
        passwordHash: passwordHash,
        sessionSecret: sessionSecret,
        sessionVersion: args.has("--rotate-secret")
            ? (Number(existing.sessionVersion) || 0) + 1
            : (Number(existing.sessionVersion) || 0),
        sessionHours: Number(existing.sessionHours) || 12,
        rememberDays: Number(existing.rememberDays) || 30
    };

    fs.mkdirSync(path.dirname(AUTH_FILE), {recursive: true, mode: 0o700});
    fs.writeFileSync(AUTH_FILE, `${JSON.stringify(config, null, 2)}\n`, {mode: 0o600});
    fs.chmodSync(AUTH_FILE, 0o600);

    if (args.has("--rotate-secret")) {
        auth.unregisterAllSessions();
    }

    console.log("Password updated.");
    console.log(`Wrote ${AUTH_FILE} (mode 600, keep it out of git).`);
    console.log(`Sessions last ${config.sessionHours}h, "remember me" ${config.rememberDays} days.`);

    if (args.has("--generate")) {
        console.log(`\nGenerated password: ${password}`);
        console.log("Store it in your password manager now - it is not recoverable.");
    }

    if (password.length < 16) {
        console.log(`\nNote: ${password.length} characters is on the short side. 16+ is better.`);
    }

    if (args.has("--rotate-secret")) {
        console.log("\nAll sessions revoked - every device must sign in again.");
    }

    console.log("\nNo restart needed - the app reloads the file on its next login.");
    console.log("Sign in at /login.");
}

/**
 * @return {object}
 */
function readExisting() {
    try {
        return JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    } catch (e) {
        return {};
    }
}

/**
 * @return {string}
 */
function generatePassword() {
    return crypto.randomBytes(18).toString("base64url");
}

/**
 * Prompts for a password without echoing it.
 *
 * This reads stdin in raw mode instead of using `readline`. readline owns the
 * whole line buffer (prompt + text), so muting the echo also mutes the prompt,
 * and its refresh sequence (ESC[1G / ESC[0J) erases it again right after it is
 * printed. Raw mode keeps the prompt visible, never echoes the input, and
 * handles paste, backspace, Ctrl+C and Ctrl+D predictably.
 *
 * @param {string} query
 * @return {Promise<string>}
 */
function askPassword(query) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error("No interactive terminal available. Use: npm run set-password -- --generate");
    }

    const stdin = process.stdin;

    return new Promise((resolve, reject) => {
        let isDone = false;

        process.stdout.write(query);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding("utf8");
        stdin.on("data", onData);
        stdin.on("end", onEnd);

        // A previous prompt may have left a whole line behind (pasted input).
        pump();

        function finish(error, result) {
            if (isDone) {
                return;
            }

            isDone = true;
            stdin.removeListener("data", onData);
            stdin.removeListener("end", onEnd);
            stdin.setRawMode(false);
            stdin.pause();
            process.stdout.write("\n");

            if (error) {
                reject(new Error(error));
            } else {
                resolve(result);
            }
        }

        /**
         * Resolves with the first complete line in the buffer, if there is one.
         * Leftover lines are kept for the next prompt.
         */
        function pump() {
            const index = inputBuffer.indexOf("\n");

            if (index === -1) {
                return;
            }

            const value = inputBuffer.slice(0, index);
            inputBuffer = inputBuffer.slice(index + 1);

            finish(null, value);
        }

        function onEnd() {
            // `printf 'pw'` without a trailing newline still counts as an answer.
            if (inputBuffer.length > 0) {
                const value = inputBuffer;
                inputBuffer = "";
                finish(null, value);
                return;
            }

            finish("No password entered.");
        }

        function onData(chunk) {
            if (isDone) {
                return;
            }

            for (const char of chunk) {
                if (char === "\u0003") {                    // Ctrl+C
                    finish("Cancelled.");
                    return;
                }

                if (char === "\u0004") {                    // Ctrl+D
                    if (inputBuffer.length === 0) {
                        finish("No password entered.");
                        return;
                    }

                    continue;
                }

                if (char === "\u007f" || char === "\b") {    // Backspace
                    inputBuffer = inputBuffer.slice(0, -1);
                    continue;
                }

                if (char === "\r" || char === "\n") {
                    inputBuffer += "\n";
                    continue;
                }

                // Control characters are ignored; the rest is kept un-echoed.
                if (char >= " ") {
                    inputBuffer += char;
                }
            }

            pump();
        }
    });
}
