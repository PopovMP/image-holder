"use strict";

class ApplicationPresenter {
    constructor(thumbnailPattern, isPassCodeRequired) {
        this.searchImage = null;
        this.passCodeSubmit = null;
        this.deleteImage = null;
        this.idIndex = 0;

        this.isPassCodeRequired = isPassCodeRequired;
        this.thumbnailPattern = thumbnailPattern;

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
        if (this.isPassCodeRequired) {
            document.getElementById("form-pass-code").classList.add("hidden");
        }
        document.getElementById("data-import-dropzone").classList.remove("hidden");
        document.getElementById("form-upload-options").classList.remove("hidden");
    }

    scaleImage(imageData, callback) {
        const canvas = document.getElementById("thumbnail-canvas");
        const context = canvas.getContext("2d");

        const imageObj = new Image();
        imageObj.addEventListener("load", imageLoaded);
        imageObj.src = imageData;

        function imageLoaded() {
            let imageAspectRatio = imageObj.width / imageObj.height;
            let canvasAspectRatio = canvas.width / canvas.height;
            let scaledHeight, scaledWidth, xStart, yStart;

            if (imageAspectRatio < canvasAspectRatio) {
                scaledHeight = canvas.height;
                scaledWidth = imageObj.width * (scaledHeight / imageObj.height);
                xStart = (canvas.width - scaledWidth) / 2;
                yStart = 0;
            } else if (imageAspectRatio > canvasAspectRatio) {
                scaledWidth = canvas.width;
                scaledHeight = imageObj.height * (scaledWidth / imageObj.width);
                xStart = 0;
                yStart = (canvas.height - scaledHeight) / 2;
            } else {
                scaledHeight = canvas.height;
                scaledWidth = canvas.width;
                xStart = 0;
                yStart = 0;
            }
            context.drawImage(imageObj, xStart, yStart, scaledWidth, scaledHeight);
            const thumbData = canvas.toDataURL();

            callback(thumbData);
        }
    }

    showImageOutput(fileMeta) {
        const idIndex = ++this.idIndex;
        const imgPreviewId = `img-${idIndex}`;
        const delId = `dell-${idIndex}`;

        const url = decodeURIComponent(fileMeta.url);
        const time = new Date(fileMeta.time).toLocaleString();
        const thumbnailCode = fileMeta.thumbUrl ? this.getThumbnailCode(fileMeta) : "";

        const messageElement =
            `<div class="message url-filed">
                <a id="${delId}" href="#" class="delete-button" title="Delete image">x</a>
                <h3 class="image-box-header">${fileMeta.name}</h3>
                <p>Size: ${fileMeta.size} kB, uploaded at: ${time}</p>
                <a href="${url}" target="_blank"><img id="${imgPreviewId}" class="image-preview" src="" alt="Image preview" /></a>
                <br />
                <input class="url-input" type="text" value="${url}" />
                ${thumbnailCode}
            </div>`;

        this.outputContent.insertAdjacentHTML("afterbegin", messageElement);

        const imagePreview = document.getElementById(imgPreviewId);
        imagePreview["src"] = url;

        const deleteButton = document.getElementById(delId);
        deleteButton.addEventListener("click", this.image_delete_click.bind(this, fileMeta.name));
    }

    getThumbnailCode(fileMeta) {
        const url = decodeURIComponent(fileMeta.url);
        const thumbUrl = decodeURIComponent(fileMeta.thumbUrl);
        const code = this.thumbnailPattern.replace("img-url", url).replace("thumb-url", thumbUrl);
        const html = `<br /><input class="url-input" type="text" value="${code}" />`;
        return html;
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
