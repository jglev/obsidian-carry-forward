import {
  App,
  Editor,
  EditorTransaction,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  View,
} from "obsidian";

interface CarryForwardPluginSettings {
  linkText: string;
  lineFormatFrom: string;
  lineFormatTo: string;
}

const DEFAULT_SETTINGS: CarryForwardPluginSettings = {
  linkText: "(see here)",
  lineFormatFrom: "",
  lineFormatTo: "",
};

const genID = (length = 5) => {
  const characters = "abcdefghijklmnopqrstuvwxyz-0123456789";
  let id = "";
  while (id.length < length) {
    id += characters[Math.floor(Math.random() * characters.length)];
  }
  return id.slice(0, length);
};

enum CopyTypes {
  SeparateLines, // 0
  CombinedLines, // 1
  LinkOnly, // 2
}

const blockIDRegex = /(?<=[\s^])\^[a-zA-Z0-9-]+$/u;

const copyForwardLines = (
  checking: boolean,
  editor: Editor,
  view: View,
  app: App,
  settings: CarryForwardPluginSettings,
  copy: CopyTypes = CopyTypes.SeparateLines
) => {
  if (checking) {
    // editorCallback always happens in a MarkdownView; the command should
    // only be shown in MarkdownView:
    return true;
  }

  const cursorFrom = editor.getCursor("from");
  const cursorTo = editor.getCursor("to");
  const minLine = cursorFrom.line;
  const maxLine = cursorTo.line;

  const transaction: EditorTransaction = {
    changes: [],
  };

  const file = app.workspace.getActiveFile();

  const updatedLines: string[] = [];
  const copiedLines: string[] = [];
  let newID = "";
  for (let lineNumber = minLine; lineNumber <= maxLine; lineNumber++) {
    let line = editor.getLine(lineNumber);
    let copiedLine = editor.getLine(lineNumber);

    if (copy === CopyTypes.SeparateLines || lineNumber === minLine) {
      // Does the line already have a block ID?
      const blockID = line.match(blockIDRegex);
      let link = "";
      console.log(71, blockID);
      if (blockID === null) {
        // There is NOT an existing line ID:
        newID = `#TEST^${genID()}`;
        link = view.app.fileManager.generateMarkdownLink(
          file,
          "/",
          `${newID}`,
          settings.linkText
        );
        line = line.replace(/ ?$/, ` ${newID}`);
        if (copy === CopyTypes.LinkOnly) {
          copiedLine = link;
        } else {
          copiedLine = copiedLine.replace(/ ?$/, link);
        }
      } else {
        // There IS an existing line ID:
        link = view.app.fileManager.generateMarkdownLink(
          file,
          "/",
          `#${blockID}`,
          settings.linkText
        );
        if (copy === CopyTypes.LinkOnly) {
          copiedLine = link;
        } else {
          copiedLine = copiedLine.replace(blockIDRegex, ` ${link}`);
        }
      }
      copiedLines.push(copiedLine);
    }

    updatedLines.push(line);
  }

  navigator.clipboard.writeText(copiedLines.join("\n")).then(() => {
    new Notice("Copied!");
  });

  transaction.changes?.push({
    from: { line: minLine, ch: 0 },
    to: { line: maxLine, ch: editor.getLine(maxLine).length },
    text: updatedLines.join("\n"),
  });
  editor.transaction(transaction);
};

export default class CarryForwardPlugin extends Plugin {
  settings: CarryForwardPluginSettings;

  async onload() {
    console.log("loading carry-forward-line plugin");

    await this.loadSettings();

    this.addRibbonIcon("dice", "CarryForward Plugin", () => {
      new Notice("This is a notice!");
    });

    this.addStatusBarItem().setText("Status Bar Text");

    this.addCommand({
      id: "carry-line-forward-separate-lines",
      name: "Copy highlighted lines, each linked to current line",
      editorCheckCallback: (checking: boolean, editor: Editor, view: View) => {
        return copyForwardLines(
          checking,
          editor,
          view,
          this.app,
          this.settings,
          CopyTypes.SeparateLines
        );
      },
    });

    this.addCommand({
      id: "carry-line-forward-combined-lines",
      name: "Copy highlighted lines, first line linked to current line",
      editorCheckCallback: (checking: boolean, editor: Editor, view: View) => {
        return copyForwardLines(
          checking,
          editor,
          view,
          this.app,
          this.settings,
          CopyTypes.CombinedLines
        );
      },
    });

    this.addCommand({
      id: "carry-line-forward-link-only",
      name: "Copy link to first highlighted line",
      editorCheckCallback: (checking: boolean, editor: Editor, view: View) => {
        return copyForwardLines(
          checking,
          editor,
          view,
          this.app,
          this.settings,
          CopyTypes.LinkOnly
        );
      },
    });

    this.addSettingTab(new CarryForwardSettingTab(this.app, this));
  }

  onunload() {
    console.log("unloading carry-forward-line plugin");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class CarryForwardSettingTab extends PluginSettingTab {
  plugin: CarryForwardPlugin;

  constructor(app: App, plugin: CarryForwardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Carry-forward" });

    new Setting(containerEl)
      .setName("Link text")
      .setDesc(
        "Display text of copied links. Leaving this blank will display the text of the actual link."
      )
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(DEFAULT_SETTINGS.linkText)
          .onChange(async (value) => {
            // if (value === "") {
            //   this.plugin.settings.linkText = DEFAULT_SETTINGS.linkText;
            // } else {
            this.plugin.settings.linkText = value;
            // }
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Remove from line")
      .setDesc(
        "A Regular Expression for any parts of a copied line to remove before adding a link."
      )
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue("")
          .onChange(async (value) => {
            this.plugin.settings.linkText = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Copied text")
      .setDesc("Display text of copied links. Use.")
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue("")
          .onChange(async (value) => {
            console.log("Secret: " + value);
            this.plugin.settings.linkText = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
