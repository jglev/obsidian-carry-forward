const { assert } = require("chai");
const fs = require("fs");

async function sleep(seconds) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

describe("Plugin", function () {
    this.timeout(60 * 1000);

    this.beforeAll(async function () {
        await browser;

        // These steps are from
        // https://github.com/trashhalo/obsidian-plugin-e2e-test/blob/master/test/spec.js :

        // Open the vault, avoiding working with a File Chooser modal:
        await browser.execute(
            "require('electron').ipcRenderer.sendSync('vaultOpen', 'test/empty_vault', false)"
        );
        await sleep(2);

        // Disable safemode and enable the plugin:
        await browser.execute(
            "app.plugins.setEnable(true);app.plugins.enablePlugin('obsidian-carry-forward')"
        );

        // Dismiss warning model and exit settings:
        await browser.$(".modal-button-container button:last-child").click();
        await sleep(0.5);
        await browser.$(".modal-close-button").click();
    })

    beforeEach(async function () {
        await browser;
        // Create a new file:
        await browser.$('.workspace').keys(['Control', 'n']);
    });

    afterEach(async function () {
        await browser;
        await browser.keys(['Escape']);  // Close any open dialog box.
        await sleep(0.5);
        await browser.keys(['Control', 'p']);  // Open the Command Palette
        await sleep(0.5);
        await browser.$(".prompt-input").keys("Delete current file");
        await sleep(0.5);
        await browser.$(".suggestion-item.is-selected").click();
        await sleep(1);
        await browser.$$('.mod-warning')[1].click();
        await sleep(1);
    });

    it("adds command", async function () {
        await browser.$('.workspace').keys(['Control', 'p']);
        await sleep(0.5);
        await browser.$(".prompt-input").keys("Carry Forward");
        const commands = (await browser.$$(".suggestion-item")).length;
        assert(commands === 12, 'Wrong number of commands in Command Palette');
    });
});