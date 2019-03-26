import formManagerData from "../data/formManagerData.js";

export default class FormManagerNew {
    constructor() {
        this.scanButton = document.querySelector(formManagerData.selectors.scanButton);
        this.scanOptions = document.querySelector(formManagerData.selectors.scanOptions);
        this.scanResultsArea = document.querySelector(formManagerData.selectors.scanResultsArea);
        this.formTemplateSelector = document.querySelector(formManagerData.selectors.formTemplateSelector);
        this.addFormTemplateInput = document.querySelector(formManagerData.selectors.addFormTemplateInput);
        this.addFormTemplateButton = document.querySelector(formManagerData.selectors.addFormTemplateButton);
        this.currentFormDOM = [];
        this.currentFormData = [];
    };

    /**
     * Initialize "formTemplates" storage if it doesn't exist yet
     */
    initializeStorage() {
        chrome.storage.local.get(formManagerData.storage.formTemplates, async (result) => {
            if (!result[formManagerData.storage.formTemplates]) {
                await this.saveDataToChromeStorage(formManagerData.storage.formTemplates, {});
            }
        })
    };

    /**
     * Pull form list form storage and fill the drop down
     */
    initializeTemplatesDropDown() {
        chrome.storage.local.get(formManagerData.storage.formTemplates, async (result) => {
            if (result[formManagerData.storage.formTemplates]) {
                $(this.formTemplateSelector).empty();
                let options = Object.keys(result[formManagerData.storage.formTemplates]);
                options.forEach((item) => {
                    let option = document.createElement('option');
                    option.text = item;
                    $(this.formTemplateSelector).append(option);
                });

                this.chooseActiveFrom();
                this.addNotChosenPlaceholder();
                let formName = await this.getActiveForm();
                let formData = await this.getForm(formName);
                this.initializeForm(formName, formData);
            } else console.error("#ERROR IN initializeTemplatesDropDown");
        });
    };

    /**
     * Set active form as chosen by default
     */
    chooseActiveFrom() {
        chrome.storage.local.get(formManagerData.storage.activeFormTemplate, (result) => {
            if (result[formManagerData.storage.activeFormTemplate]) {
                $(this.formTemplateSelector)[0].value = result[formManagerData.storage.activeFormTemplate];
            }
        })
    };

    /**
     * Get form array
     * @param templateName
     */
    getForm(templateName) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(formManagerData.storage.formTemplates, (result) => {
                if (result[formManagerData.storage.formTemplates][templateName]) {
                    resolve(result[formManagerData.storage.formTemplates][templateName]);
                } else {
                    console.error("#ERROR IN getForm: following form wasn't found: [" + templateName + "]");
                    reject(null);
                }
            })
        })
    }

    /**
     * Getter for active form
     */
    getActiveForm() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(formManagerData.storage.activeFormTemplate, (result) => {
                if (result[formManagerData.storage.activeFormTemplate]) {
                    resolve(result[formManagerData.storage.activeFormTemplate]);
                } else {
                    console.error("#ERROR IN getActiveForm");
                    reject(null);
                }
            })
        })
    };

    /**
     * Set 'Not chosen' placeholder to form formTemplates selector
     */
    addNotChosenPlaceholder() {
        if ($(this.formTemplateSelector)[0].options.length === 0) {
            let placeholderOption = $('<option></option>');
            $(placeholderOption)
                .attr('selected', true)
                .attr('disabled', true)
                .text('Not chosen');
            $(this.formTemplateSelector).prepend(placeholderOption);
        }
    };

    /**
     * Update chrome template in storage with some template
     * @param templateName {String}
     * @param template
     */
    updateTemplateToStorage(templateName, template) {
        return new Promise(resolve => {
            chrome.storage.local.get([formManagerData.storage.formTemplates], async (result) => {
                if (result[formManagerData.storage.formTemplates]) {
                    result[formManagerData.storage.formTemplates][templateName] = template;
                    await this.saveDataToChromeStorage(formManagerData.storage.formTemplates, result[formManagerData.storage.formTemplates]);
                    resolve();
                } else console.error("#ERROR IN updateTemplateToStorage")
            })
        })
    };

    /**
     * Setter for this.currentFormData
     * @param form {Array}
     */
    setFormData(form) {
        this.currentFormData = form;
    };

    saveDataToChromeStorage(storageName, data) {
        return new Promise(resolve => {
            chrome.storage.local.set({[storageName]: data}, () => {
                resolve();
            });
        });
    };

    /**
     * Setter for this.currentFormDOM
     * this.currentFormData should not be empty!!!
     */
    setFormDOM() {
        this.currentFormDOM = [];
        if (this.currentFormData.length > 0) {
            this.currentFormData.forEach((item) => {
                item.tagName === "INPUT"
                    ? this.currentFormDOM.push(this.createInputBlock(item.name, item.value))
                    : this.currentFormDOM.push(this.createBlock(item.name, item.value, item.tagName))
            });
        }
    };

    /**
     * Setup change event for drop down responsible for switching between active form templates
     */
    setupFormChangeEvent() {
        $(this.formTemplateSelector).change(async (event) => {
            await this.saveDataToChromeStorage(formManagerData.storage.activeFormTemplate, event.target.value);
            chrome.storage.local.get(formManagerData.storage.formTemplates, (result) => {
                if (result[formManagerData.storage.formTemplates][event.target.value]) {
                    this.initializeForm(event.target.value, result[formManagerData.storage.formTemplates][event.target.value]);
                } else console.error("#ERROR IN setupFormChangeEvent: storage not found [" + event.target.value + "]")
            });
        })
    };

    /**
     * Listen to content scripts for array of scanned DOM elements
     */
    setupResultDOMListener() {
        chrome.runtime.onMessage.addListener(async (message) => {
            if (message.resultDOM) {
                await this.updateTemplateToStorage(formManagerData.storage.scanResults, message.resultDOM);
                await this.saveDataToChromeStorage(formManagerData.storage.activeFormTemplate, formManagerData.storage.scanResults);
                this.initializeTemplatesDropDown();
            }
        })
    };

    /**
     * Send request to scan DOM to content scripts
     */
    setupScanButtonClickEvent() {
        $(this.scanButton).click(() => {
            let scanOption = this.scanOptions.options[this.scanOptions.options.selectedIndex].value;
            chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {scanDOM: scanOption});
            });
        })
    };

    /**
     * Setup remove event upon click on "-" button for this.currentDOM
     * Removes from DOM and storage
     */
    setupRemoveFromDOMEvents() {
        this.currentFormDOM.forEach((item) => {
            $(item).find('button')[0].addEventListener("click", () => {
                $(item).remove();
            })
        })
    };

    /**
     * Remove from storage as well
     * @param templateName
     */
    setupRemoveFromStorageEvents(templateName) {
        for (let i = 0; i < this.currentFormDOM.length; i++) {
            $(this.currentFormDOM[i]).find("button").on("click", async () => {
                this.currentFormData.splice(i, 1);
                await this.updateTemplateToStorage(templateName, this.currentFormData);
                this.initializeForm(templateName, this.currentFormData);
            })
        }
    };

    /**
     * Setup click event for this.addFormTemplateButton
     */
    setupAddFormButtonClickEvent() {
        $(this.addFormTemplateButton).click(async () => {
            if ($(this.addFormTemplateInput)[0].value) {
                if (this.currentFormData.length > 0 && this.currentFormDOM.length > 0) {
                    await this.updateTemplateToStorage($(this.addFormTemplateInput)[0].value, this.currentFormData);
                } else console.error("#ERROR IN setupAddFormButtonClickEvent: 'current' values aren't empty")
            } else console.error("#ERROR IN setupAddFormButtonClickEvent: incorrect input")
        })
    };

    /**
     * Add input field to page
     * @param name
     * @param value
     */
    createInputBlock(name, value) {
        return $('<div class="item-container mt-1 mb-1">' +
            `                <label class="mb-0">${name} [Input]</label>` +
            '                <div class="btn-group">' +
            `                    <input type="text" class="form-control col-7" value='${value}'>` +
            '                    <select class="custom-select col-3">' +
            '                        <option value="Only empty">None</option>' +
            '                        <option value="Only filled">Username randomized</option>' +
            '                        <option value="Only input">Email randomized</option>' +
            '                    </select>' +
            '                    <button class="btn btn-outline-danger col-2">-</button>' +
            '                </div>' +
            '            </div>')[0];
    };

    /**
     * Add common field to page
     * @param name
     * @param value
     * @param tagName
     */
    createBlock(name, value, tagName) {
        return $('<div class="item-container mt-1 mb-1">' +
            `                   <label class="mb-0" for="addDeviceInput">${name} [${tagName}]</label>` +
            '                   <div class="btn-group w-100">' +
            `                       <input type="text" class="form-control col-10" value='${value}'>` +
            '                       <button class="btn btn-outline-danger col-2">-</button>' +
            '                   </div>' +
            '                </div>')[0];
    };

    /**
     * All steps combined in one method
     */
    initializeForm(templateName, form) {
        if (templateName !== null) {
            this.setFormData(form);
            this.setFormDOM();
            this.setupRemoveFromStorageEvents(templateName);
            this.setupRemoveFromDOMEvents();
            this.rebuildDOM();
        }
    };

    /**
     * Clear DOM and then build
     */
    rebuildDOM() {
        $(this.scanResultsArea).empty();
        this.buildDOM();
    };

    /**
     * Append all elements from this.currentFormDOM to this.scanResultsArea
     */
    buildDOM() {
        if (this.currentFormDOM.length > 0) {
            this.currentFormDOM.forEach((item) => {
                $(this.scanResultsArea).append(item);
            })
        } else console.error("#ERROR in buildDOM: this.currentFormDOM is empty");
    }
}
