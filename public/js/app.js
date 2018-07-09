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

        this.showImages(appModel.preloadModel);
    }

    showImages(preloadModel) {
        this.presenter.clearOutput();

        const sortedModel = preloadModel.sort((a, b) => a.time - b.time);

        for (const model of sortedModel) {
            this.presenter.showImageOutput(model);
        }
    }

    dropper_fileLoaded(fileName, image) {
        this.uploadFile(fileName, image);
    }

    dropper_warningOccurred(fileName, warningMessage) {
        const message = `Problem with file "${fileName}": ${warningMessage}`;
        this.presenter.showWarning(message)
    }

    dropper_errorOccurred(fileName, errorMessage) {
        const message = `Error with file "${fileName}": ${errorMessage}`;
        this.presenter.showError(message)
    }

    uploadFile(fileName, image) {
        const optionsModel = this.presenter.getSubmitOptions();
        const encodedPassCode = encodeURIComponent(optionsModel.passCode);
        const encodedFileName = encodeURIComponent(fileName);

        const headers = [
            {header: "PassCode", value: encodedPassCode},
            {header: "FileName", value: encodedFileName},
            {header: "OverrideExistingFile", value: optionsModel.isOverrideExisting},
            {header: "Content-type", value: "multipart/form-data"}
        ];

        IoService.postData("api/upload", image, headers, this.uploadFile_ready.bind(this))
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
        const encodedSearchPhrase = encodeURIComponent(phrase);

        const headers = [
            {header: "SearchPhrase", value: encodedSearchPhrase},
        ];

        IoService.postData("api/search", {}, headers, this.searchImage_ready.bind(this))
    }

    searchImage_ready(err, data) {
        if (err) {
            this.presenter.showError("Error with search image: " + err);
        } else {
            this.showImages(data);
        }
    }
}

class ApplicationPresenter {
    constructor(appModel) {
        this.searchImage = null;
        this.idIndex = 999;

        this.appModel = appModel;

        if (this.appModel.isPassCodeRequired) {
            this.passCodeform = document.getElementById("form-pass-code");
            this.passCodeElement = document.getElementById("pass-code-element");
            this.passCodeform.addEventListener("submit", this.formSubmit.bind(this))
        }

        this.optionOverrideExistingFile = document.getElementById("override-existing-file");

        this.formSearch = document.getElementById("form-search");
        this.inputSearch = document.getElementById("input-search");

        this.formSearch.addEventListener("submit", this.formSearch_submit.bind(this));

        this.outputContent = document.getElementById("output-content");
    }

    getSubmitOptions() {
        const passCode = this.appModel.isPassCodeRequired ? this.passCodeElement.value : "";

        const optionsModel = {
            passCode: passCode,
            isOverrideExisting: this.optionOverrideExistingFile.checked
        };

        return optionsModel;
    }

    showImageOutput(fileMeta) {
        const urlBoxId = `input-${++this.idIndex}`;
        const imgPreviewId = `img-${++this.idIndex}`;
        const url = decodeURIComponent(fileMeta.url);
        const time = new Date(fileMeta.time).toLocaleString();

        const messageElement =
            `<div class="message url-filed">
                <h3>${fileMeta.name}</h3>
                <p>
                    Size: ${fileMeta.size} kB, uploaded at: ${time}
                </p>
                <a href="${url}" target="_blank"><img id="${imgPreviewId}" class="image-preview" src="" alt="Image preview" /></a>
                <br />
                <input class="url-input" type="text" value="${url}" id="${urlBoxId}" />
            </div>`;

        this.outputContent.insertAdjacentHTML("afterbegin", messageElement);

        const urlBox = document.getElementById(urlBoxId);
        urlBox.select();

        const imagePreview = document.getElementById(imgPreviewId);
        imagePreview["src"] = url;
    }

    clearOutput() {
        this.outputContent.innerHTML = "";
    }

    showError(errorMessage) {
        const messageElement = `<div class="message error">${errorMessage}</div>`;
        this.outputContent.insertAdjacentHTML("afterbegin", messageElement);
    }

    showWarning(warningMessage) {
        const messageElement = `<div class="message warning">${warningMessage}</div>`;
        this.outputContent.insertAdjacentHTML("afterbegin", messageElement);
    }

    formSearch_submit(event) {
        event.preventDefault();

        if (typeof this.searchImage === "function") {
            const phrase = this.inputSearch.value;
            this.searchImage(phrase);
        }
    }

    formSubmit(event) {
        event.preventDefault();
    }
}

class FileDropper {
    constructor(fileExtensions) {
        this.fileLoaded = null;
        this.errorOccurred = null;
        this.warningOccurred = null;
        this.fileExtensions = fileExtensions;

        this.dropperPanel = document.getElementById("data-import-dropzone");
        this.dropperInput = document.getElementById("data-import-input");

        this.dropperPanel.addEventListener("click", this.view_dropperPanel_click.bind(this), false);
        this.dropperPanel.addEventListener("dragover", this.view_dropperPanel_dragOver.bind(this), false);
        this.dropperPanel.addEventListener("dragleave", this.view_dropperPanel_dragLeave.bind(this), false);
        this.dropperPanel.addEventListener("mouseleave", this.view_dropperPanel_mouseLeave.bind(this), false);
        this.dropperPanel.addEventListener("drop", this.view_dropperPanel_drop.bind(this), false);
        this.dropperInput.addEventListener("change", this.view_inputDropzone_change.bind(this), false);
    }

    view_dropperPanel_click() {
        this.dropperInput.click();
    }

    view_dropperPanel_dragOver(event) {
        event.stopPropagation();
        event.preventDefault();

        this.dropperPanel.className = "hover";
    }

    view_dropperPanel_dragLeave(event) {
        event.stopPropagation();
        event.preventDefault();

        this.dropperPanel.className = "";
    }

    view_dropperPanel_mouseLeave(event) {
        event.stopPropagation();
        event.preventDefault();

        this.dropperPanel.className = "";
    }

    view_dropperPanel_drop(event) {
        event.stopPropagation();
        event.preventDefault();

        if (event.dataTransfer.files instanceof FileList) {
            for (const file of event.dataTransfer.files) {
                this.readFile(file);
            }
        }

        this.dropperInput.value = "";
    }

    view_inputDropzone_change(event) {
        event.stopPropagation();
        event.preventDefault();

        if (event.target.files instanceof FileList) {
            for (const file of event.target.files) {
                this.readFile(file);
            }
        }

        this.dropperInput.value = "";
    }

    readFile(file) {
        const isFile = file instanceof File;

        if (!isFile) {
            this.onWarningOccurred("", "It is not a file");
            return;
        }

        const isSupportedFile = this.testFileExtension(file.name, this.fileExtensions);

        if (!isSupportedFile) {
            this.onWarningOccurred(file.name, "It is not a supported file type.");
            return;
        }

        const fileReader = new FileReader();
        fileReader.addEventListener("load", this.fileReader_load.bind(this, file.name), false);
        fileReader.readAsDataURL(file);
    }

    testFileExtension(fileName, extensions) {
        for (const extension of extensions) {
            const regExp = new RegExp(`.${extension}$`, "i");
            const isMatch = regExp.test(fileName);
            if (isMatch) {
                return true;
            }
        }
        return false;
    }

    fileReader_load(fileName, event) {
        event.stopPropagation();
        event.preventDefault();

        event.target.removeEventListener("load", this.fileReader_load);

        try {
            this.onFileLoaded(fileName, event.target.result);
        } catch (e) {
            this.onErrorOccurred(fileName, e.message);
        }
    }

    onFileLoaded(fileName, fileContent) {
        if (typeof this.fileLoaded === "function") {
            this.fileLoaded(fileName, fileContent);
        }
    }

    onWarningOccurred(fileName, warningMessage) {
        if (typeof this.warningOccurred === "function") {
            this.warningOccurred(fileName, warningMessage);
        }
    }

    onErrorOccurred(fileName, errorMessage) {
        if (typeof this.errorOccurred === "function") {
            this.errorOccurred(fileName, errorMessage);
        }
    }
}

class IoService {
}

IoService.postData = function (path, data, headers, callback) {
    const httpRequest = new XMLHttpRequest();
    httpRequest.open("POST", path, true);

    for (let i = 0; i < headers.length; i++) {
        httpRequest.setRequestHeader(headers[i].header, headers[i].value);
    }

    httpRequest.onload = httpRequest_load;
    httpRequest.onerror = httpRequest_error;
    httpRequest.send(data);

    function httpRequest_load() {
        try {
            const res = httpRequest.responseText;
            const isErrDataJson = /^{"err":.+"data":.+}$/.test(res);
            if (isErrDataJson) {
                const response = JSON.parse(res);
                callback(response.err, response.data);
            }
            else {
                callback(null, res);
            }
        }
        catch (e) {
            callback(e.toString(), null);
        }
    }

    function httpRequest_error() {
        callback("An error occurred during the transaction", null);
    }
};
