"use strict";

class ApplicationPresenter {
    constructor(isPassCodeRequired) {
        this.searchImage = null;
        this.passCodeSubmit = null;
        this.deleteImage = null;
        this.idIndex = 0;

        this.isPassCodeRequired = isPassCodeRequired;

        if (this.isPassCodeRequired) {
            this.formPassCode = document.getElementById("form-pass-code");
            this.inputPassCode = document.getElementById("pass-code-element");
            this.formPassCode.addEventListener("submit", this.formPassCode_submit.bind(this))
        } else {
            this.showUploadControls();
        }

        this.checkboxForceUpload = document.getElementById("checkbox-force-upload");

        this.formSearch = document.getElementById("form-search");
        this.inputSearch = document.getElementById("input-search");
        this.outputContent = document.getElementById("output-content");

        this.formSearch.addEventListener("submit", this.formSearch_submit.bind(this));
    }

    getSubmitOptions() {
        const passCode = this.isPassCodeRequired ? this.inputPassCode.value : "";

        const optionsModel = {
            passCode: passCode,
            isForceUpload: this.checkboxForceUpload.checked
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

    showWarning(warningMessage) {
        const messageElement = `<div class="message warning">${warningMessage}</div>`;
        this.outputContent.insertAdjacentHTML("afterbegin", messageElement);
    }

    showError(errorMessage) {
        const messageElement = `<div class="message error">${errorMessage}</div>`;
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
