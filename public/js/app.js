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
        this.presenter.passCodeSubmit = this.presenter_passCode_submit.bind(this);
        this.presenter.deleteImage = this.presenter_deleteImage_click.bind(this);

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
        const fileSize = 0.75 * image.length;
        const fileSizeKb = Math.round(100 * fileSize / 1024) / 100;

        if (fileSizeKb > this.appModel.maxFileSizeKb) {
            const message = `The file is too big! It must be maximum ${this.appModel.maxFileSizeKb} kB`;
            this.presenter.showWarning(message);
            return;
        }

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

    presenter_passCode_submit(passCode) {
        const encodedPassCode = encodeURIComponent(passCode);

        const headers = [
            {header: "PassCode", value: encodedPassCode},
        ];

        IoService.postData("api/validate", {}, headers, this.validate_ready.bind(this))
    }

    validate_ready(err, isValid) {
        if (err) {
            this.presenter.showError("Error with validation: " + err);
        } else {
            if (isValid) {
                this.presenter.showUploadControls();
            } else {
                this.presenter.showWarning("Wrong pass code!")
            }
        }
    }

    presenter_deleteImage_click(fileName) {
        const optionsModel = this.presenter.getSubmitOptions();
        const encodedPassCode = encodeURIComponent(optionsModel.passCode);
        const encodedFileName = encodeURIComponent(fileName);

        const headers = [
            {header: "PassCode", value: encodedPassCode},
            {header: "FileName", value: encodedFileName},
        ];

        IoService.postData("api/delete", {}, headers, this.deleteFile_ready.bind(this))
    }

    deleteFile_ready(err, data) {
        if (err) {
            this.presenter.showError("Error with delete image: " + err);
        } else {
            this.presenter.showInfo(data);
        }
    }
}

class ApplicationPresenter {
    constructor(appModel) {
        this.searchImage = null;
        this.passCodeSubmit = null;
        this.deleteImage = null;
        this.idIndex = 999;

        this.appModel = appModel;

        if (this.appModel.isPassCodeRequired) {
            this.formPassCode = document.getElementById("form-pass-code");
            this.inputPassCode = document.getElementById("pass-code-element");
            this.formPassCode.addEventListener("submit", this.formPassCode_submit.bind(this))
        } else {
            this.showUploadControls();
        }

        this.optionOverrideExistingFile = document.getElementById("override-existing-file");

        this.formSearch = document.getElementById("form-search");
        this.inputSearch = document.getElementById("input-search");

        this.formSearch.addEventListener("submit", this.formSearch_submit.bind(this));

        this.outputContent = document.getElementById("output-content");
    }

    getSubmitOptions() {
        const passCode = this.appModel.isPassCodeRequired ? this.inputPassCode.value : "";

        const optionsModel = {
            passCode: passCode,
            isOverrideExisting: this.optionOverrideExistingFile.checked
        };

        return optionsModel;
    }

    showUploadControls() {
        document.getElementById("form-pass-code").classList.add("hidden");
        document.getElementById("data-import-dropzone").classList.remove("hidden");
        document.getElementById("form-upload-options").classList.remove("hidden");
    }

    showImageOutput(fileMeta) {
        const idIndex = ++this.idIndex;
        const urlBoxId = `input-${idIndex}`;
        const imgPreviewId = `img-${idIndex}`;
        const delId = `dell-${idIndex}`;

        const url = decodeURIComponent(fileMeta.url);
        const time = new Date(fileMeta.time).toLocaleString();

        const messageElement =
            `<div class="message url-filed">
                <a id="${delId}" href="#" class="delete-button" title="Delete image">x</a>
                <h3 class="image-box-header">${fileMeta.name}</h3>
                <p>Size: ${fileMeta.size} kB, uploaded at: ${time}</p>
                <a href="${url}" target="_blank"><img id="${imgPreviewId}" class="image-preview" src="" alt="Image preview" /></a>
                <br />
                <input class="url-input" type="text" value="${url}" id="${urlBoxId}" />
            </div>`;

        this.outputContent.insertAdjacentHTML("afterbegin", messageElement);

        const urlBox = document.getElementById(urlBoxId);
        urlBox.select();

        const imagePreview = document.getElementById(imgPreviewId);
        imagePreview["src"] = url;

        const deleteButton = document.getElementById(delId);
        deleteButton.addEventListener("click", this.image_delete_click.bind(this, fileMeta.name));
    }

    clearOutput() {
        this.outputContent.innerHTML = "";
    }

    showInfo(message) {
        const messageElement = `<div class="message info">${message}</div>`;
        this.outputContent.insertAdjacentHTML("afterbegin", messageElement);
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

    formPassCode_submit(event) {
        event.preventDefault();

        if (typeof this.passCodeSubmit === "function") {
            const passCode = this.inputPassCode.value;
            this.passCodeSubmit(passCode);
        }
    }

    image_delete_click(fileName) {
        event.preventDefault();

        const isDelete = confirm(`Are you sure you want to permanently delete the "${fileName}" file?`);
        if (isDelete) {
            if (typeof this.deleteImage === "function") {
                this.deleteImage(fileName);
            }
        }
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
