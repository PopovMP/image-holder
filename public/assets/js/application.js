"use strict";

class Application {
    constructor(appModel) {
        this.appModel = appModel;
        const fileExtensions = appModel.acceptedFiles.map(e => `.${e}`);

        this.dropper = new FileDropper(fileExtensions);
        this.dropper.fileLoaded = this.dropper_fileLoaded.bind(this);
        this.dropper.warningOccurred = this.dropper_warningOccurred.bind(this);
        this.dropper.errorOccurred = this.dropper_errorOccurred.bind(this);

        this.presenter = new ApplicationPresenter(this.appModel);
        this.presenter.searchImage = this.presenter_searchImage_submit.bind(this);
        this.presenter.deleteImage = this.presenter_deleteImage_click.bind(this);

        this.showImages(appModel.preloadModel);
    }

    showImages(imageMetaList) {
        this.presenter.clearOutput();

        if (imageMetaList.length === 0) {
            this.presenter.showWarning("No images found.");
            return;
        }

        const sortedModel = imageMetaList.sort((a, b) => a.time - b.time);

        for (const model of sortedModel) {
            this.presenter.showImageOutput(model);
        }
    }

    dropper_fileLoaded(fileName, image) {
        const fileSize = 0.75 * image.length;
        const fileSizeKb = Math.round(100 * fileSize / 1024) / 100;

        if (fileSizeKb > this.appModel.maxFileSizeKb) {
            const message = `The file is too big! It must be maximum ${this.appModel.maxFileSizeKb} kB`;
            this.presenter.showWarning(message);
            return;
        }

        this.presenter.scaleImage(image, this.appModel.thumbnailWidth, this.appModel.thumbnailHeight,
            this.presenter_scaleImage_ready.bind(this, fileName, image));
    }

    presenter_scaleImage_ready(fileName, image, thumbnail) {
        this.uploadFile(fileName, image, thumbnail);
    }

    dropper_warningOccurred(fileName, warningMessage) {
        const message = `Problem with file "${fileName}": ${warningMessage}`;
        this.presenter.showWarning(message);
    }

    dropper_errorOccurred(fileName, errorMessage) {
        const message = `Error with file "${fileName}": ${errorMessage}`;
        this.presenter.showError(message);
    }

    uploadFile(fileName, image, thumbnail) {
        const optionsModel = this.presenter.getSubmitOptions();

        const headers = [
            {header: "FileName", value: encodeURIComponent(fileName)},
            {header: "ForceUpload", value: optionsModel.isForceUpload},
            {header: "Content-Type", value: "application/json"}
        ];

        const encodedData = JSON.stringify({image: image, thumbnail: thumbnail});

        IoService.postData("api/upload", encodedData, headers, this.uploadFile_ready.bind(this));
    }

    uploadFile_ready(err, fileMeta) {
        if (err) {
            this.presenter.showError("Error with file upload: " + err);
        } else if (fileMeta) {
            this.presenter.showImageOutput(fileMeta);
        } else {
            this.presenter.showError("Something went wrong!");
        }
    }

    presenter_searchImage_submit(phrase) {
        const headers = [
            {header: "SearchPhrase", value: encodeURIComponent(phrase)}
        ];

        IoService.postData("api/search", "{}", headers, this.searchImage_ready.bind(this));
    }

    searchImage_ready(err, data) {
        if (err) {
            this.presenter.showError("Error with search image: " + err);
        } else {
            this.showImages(data);
        }
    }

    presenter_deleteImage_click(fileName, messageBoxId) {
        const headers = [
            {header: "FileName", value: encodeURIComponent(fileName)}
        ];

        IoService.postData("api/delete", "{}", headers, this.deleteFile_ready.bind(this, messageBoxId));
    }

    deleteFile_ready(messageBoxId, err, data) {
        if (err) {
            this.presenter.showError("Error with delete image: " + err);
        } else {
            this.presenter.showInfo(data);
            this.presenter.removeMessageBox(messageBoxId);
        }
    }
}

/*
 * The page model is passed as a data attribute rather than an inline script so
 * that the Content-Security-Policy can forbid inline JavaScript entirely.
 */
window.addEventListener("DOMContentLoaded", () => {
    const wrapper = document.getElementById("wrapper");

    if (!wrapper) {
        return;
    }

    let appModel;

    try {
        appModel = JSON.parse(wrapper.dataset.appModel);
    } catch (e) {
        console.error("Cannot read the page model.", e);
        showFatalMessage("The page data could not be read. Reload the page; if it keeps happening, check the browser console.");
        return;
    }

    try {
        new Application(appModel);
    } catch (e) {
        console.error("The application failed to start.", e);
        showFatalMessage(`The page failed to start: ${e.message}`);
    }
});

/**
 * Shows a visible error box even when the presenter could not be created.
 * A silent blank page is the worst possible failure mode here.
 * @param {string} message
 */
function showFatalMessage(message) {
    const host = document.getElementById("messages");

    if (!host) {
        return;
    }

    const box = document.createElement("div");
    box.className = "message error";

    const text = document.createElement("p");
    text.className = "message-text";
    text.textContent = message;

    box.appendChild(text);
    host.insertBefore(box, host.firstChild);
}
