const { assert } = require("chai");
const fs = require("fs");

// Note: Supported keyboard key names can be found here:
// https://w3c.github.io/webdriver/webdriver-spec.html#keyboard-actions

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

        // Dismiss warning model:
        await browser.$(".modal-button-container button:last-child").click();
        await sleep(0.5);

        // Change the default settings text:
        await (await browser.$$('.vertical-tab-header-group')[1]).$('.vertical-tab-nav-item').click();
        await browser.$('.setting-item-control').click();
        await browser.keys('here');
        await sleep(1);

        // Exit settings:
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

    it("adds commands", async function () {
        await browser.$('.view-content').keys(['Control', 'p']);
        await sleep(0.5);
        await browser.$(".prompt-input").keys("Carry Forward");
        const commands = (await browser.$$(".suggestion-item")).length;
        assert(commands === 12, 'Wrong number of commands in Command Palette');
    });

    it("correctly copies the contents of all four lines in a block", async function () {
        const testText = `- Lorem ipsum 1
    - Lorem ipsum 2
        - Lorem ipsum 3
    - Lorem ipsum 4
`;
        await browser.$('.view-content').click();
        await browser.$('.view-content').keys(testText);

        // Select text:
        await browser.$('.CodeMirror-line').keys(['ArrowUp']);
        await browser.$('.CodeMirror-line').keys(['End']);
        await browser.$('.CodeMirror-line').keys(['Shift', 'ArrowUp']);
        await browser.$('.CodeMirror-line').keys(['Shift', 'ArrowUp']);
        await browser.$('.CodeMirror-line').keys(['Shift', 'ArrowUp']);
        await browser.$('.CodeMirror-line').keys(['Shift', 'Home']);

        await browser.$('.view-content').keys(['Control', 'p']);
        await sleep(1);
        await browser.$(".prompt-input").keys("Carry Forward: Copy selection with each line linked to its copied source (default link text)");
        await browser.$(".suggestion-item").click();
        await sleep(1);

        // Check the contents of the clipboard:
        await $('.view-content').click({ button: "right" });
        await sleep(1);
        await $$('.menu-item')[4].click(); // "Select all"

        await $('.view-content').click({ button: "right" });
        await sleep(1);
        await $$('.menu-item')[4].click(); // "Paste"

        const pastedText = await $('.view-content').getText();

        console.log(101, pastedText);

        const testTextSplit = testText.split(/\r?\n/);
        const pastedTextSplit = pastedText.split(/\r?\n/);

        assert(pastedTextSplit[0 + 1].startsWith(testTextSplit[0]), `Line 0 ("${testTextSplit[0]}") is not the same ("${pastedTextSplit[0 + 1]}")`);
        assert(pastedTextSplit[0 + 1].endsWith('|here]])'), `Line 0 ("${pastedTextSplit[0 + 1]}") does not end with "|here]])")`);
    });
});