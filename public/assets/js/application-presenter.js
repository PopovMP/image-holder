"use strict";

class ApplicationPresenter {
    constructor(appModel) {
        this.searchImage = null;
        this.deleteImage = null;
        this.idIndex = 0;

        this.thumbnailPattern = appModel.thumbnailPattern;

        this.checkboxForceUpload = document.getElementById("checkbox-force-upload");
        this.formSearch = document.getElementById("form-search");
        this.inputSearch = document.getElementById("input-search");
        this.messages = document.getElementById("messages");
        this.grid = document.getElementById("image-grid");

        this.formSearch.addEventListener("submit", this.formSearch_submit.bind(this));

        // Clicking a link field selects its whole value, ready to copy.
        this.grid.addEventListener("click", this.grid_click.bind(this));
    }

    getSubmitOptions() {
        return {
            isForceUpload: this.checkboxForceUpload.checked
        };
    }

    /**
     * Escapes text before it is placed into an HTML string. File names are
     * attacker controlled, so this is what keeps a crafted upload from
     * injecting markup into the page.
     * @param {*} value
     * @return {string}
     */
    static escapeHtml(value) {
        return String(value === undefined || value === null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /**
     * @param {string} value
     * @return {string} a usable absolute URL, or "" when there is none
     */
    static toUrl(value) {
        if (typeof value !== "string" || value.length === 0) {
            return "";
        }

        return decodeURIComponent(value).replace(/ /g, "%20");
    }

    scaleImage(imageData, maxWidth, maxHeight, callback) {
        const mimeType = this.getImageMimeType(imageData);

        const htmlImage = new Image();
        htmlImage.addEventListener("load", imageLoaded);
        htmlImage.src = imageData;

        function imageLoaded() {
            const srcRatio = htmlImage.width / htmlImage.height;
            const maxRatio = maxWidth / maxHeight;
            const width = srcRatio < maxRatio ? Math.round(htmlImage.width * maxHeight / htmlImage.height) : maxWidth;
            const height = srcRatio > maxRatio ? Math.round(htmlImage.height * maxWidth / htmlImage.width) : maxHeight;

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");

            context.drawImage(htmlImage, 0, 0, width, height);

            const thumbData = canvas.toDataURL(mimeType);

            callback(thumbData);
        }
    }

    getImageMimeType(imageData) {
        const match = imageData.match(/data:(.*);base64/);
        const mimeType = match && match.length === 2 ? match[1] : "";
        return mimeType;
    }

    /**
     * Renders one image card. The card shows the thumbnail (small, quick) and
     * links to the full-size file. Every card has the same structure, so all
     * cards in a row are the same height and the fields line up at the bottom.
     * @param {object} fileMeta
     */
    showImageOutput(fileMeta) {
        const cardId = `card-${++this.idIndex}`;
        const deleteId = `${cardId}-delete`;

        const url = ApplicationPresenter.toUrl(fileMeta.url);
        const previewUrl = ApplicationPresenter.toUrl(fileMeta.thumbUrl) || url;
        const time = new Date(fileMeta.time).toLocaleString();
        const forumCode = this.getThumbnailCode(fileMeta);

        const escape = ApplicationPresenter.escapeHtml;

        const card =
            `<article class="image-card" id="${cardId}">
                <button id="${deleteId}" class="delete-button" type="button" title="Delete image">&times;</button>
                <a class="card-preview" href="${escape(url)}" target="_blank" rel="noopener noreferrer">
                    <img src="${escape(previewUrl)}" alt="${escape(fileMeta.name)}" loading="lazy" decoding="async" />
                </a>
                <div class="card-body">
                    <h3 class="card-title" title="${escape(fileMeta.name)}">${escape(fileMeta.name)}</h3>
                    <p class="card-meta">${escape(fileMeta.size)} kB &middot; ${escape(time)}</p>
                    <div class="card-fields">
                        <label class="field-label" for="${cardId}-url">Image URL</label>
                        <input id="${cardId}-url" class="url-input" type="text" readonly="readonly" value="${escape(url)}" />
                        <label class="field-label" for="${cardId}-forum">Forum code</label>
                        <input id="${cardId}-forum" class="url-input" type="text" readonly="readonly" value="${escape(forumCode)}" />
                    </div>
                </div>
            </article>`;

        this.grid.insertAdjacentHTML("afterbegin", card);

        const deleteButton = document.getElementById(deleteId);
        deleteButton.addEventListener("click", this.image_delete_click.bind(this, fileMeta.name, cardId));
    }

    getThumbnailCode(fileMeta) {
        const url = ApplicationPresenter.toUrl(fileMeta.url);
        const thumbUrl = ApplicationPresenter.toUrl(fileMeta.thumbUrl) || url;

        // Split/join replaces every placeholder, not just the first one.
        return this.thumbnailPattern
            .split("img-url").join(url)
            .split("thumb-url").join(thumbUrl);
    }

    clearOutput() {
        this.grid.innerHTML = "";
    }

    showInfo(message) {
        this.showMessage(message, "info");
    }

    showWarning(message) {
        this.showMessage(message, "warning");
    }

    showError(message) {
        this.showMessage(message, "error");
    }

    showMessage(message, tag) {
        const idIndex = ++this.idIndex;
        const messageBoxId = `message-${idIndex}`;
        const delId = `${messageBoxId}-close`;

        const messageElement =
            `<div class="message ${tag}" id="${messageBoxId}">
                <button id="${delId}" class="delete-button" type="button" title="Dismiss">&times;</button>
                <p class="message-text">${ApplicationPresenter.escapeHtml(message)}</p>
            </div>`;

        this.messages.insertAdjacentHTML("afterbegin", messageElement);

        const deleteButton = document.getElementById(delId);
        deleteButton.addEventListener("click", this.removeMessage_click.bind(this, messageBoxId));
    }

    removeMessageBox(messageBoxId) {
        const element = document.getElementById(messageBoxId);

        if (element) {
            element.remove();
        }
    }

    formSearch_submit(event) {
        event.preventDefault();

        if (typeof this.searchImage === "function") {
            const phrase = this.inputSearch.value;
            this.searchImage(phrase);
        }
    }

    grid_click(event) {
        const target = event.target;

        if (target && typeof target.matches === "function" && target.matches("input.url-input")) {
            target.select();
        }
    }

    image_delete_click(fileName, messageBoxId, event) {
        event.preventDefault();

        const isDelete = confirm(`Are you sure you want to permanently delete the "${fileName}" file?`);
        if (isDelete) {
            if (typeof this.deleteImage === "function") {
                this.deleteImage(fileName, messageBoxId);
            }
        }
    }

    removeMessage_click(messageBoxId, event) {
        event.preventDefault();

        this.removeMessageBox(messageBoxId);
    }
}
