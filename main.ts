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
  linkText: "",
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
  SeparateLines,
  CombinedLines,
  LinkOnly,
  LinkOnlyEmbed,
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

  const regexValidation = validateRegex(settings.lineFormatFrom);
  if (regexValidation.valid !== true) {
    new Notice(
      `Error: 'From' setting is invalid:\n\n${regexValidation.string}\n\nPlease update the Carry-Forward settings and try again.`,
      1000 * 30 // 30 seconds
    );
    return;
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
    let copiedLine = line;
    if (lineNumber === minLine || lineNumber === maxLine) {
      copiedLine = line.slice(
        lineNumber === minLine ? cursorFrom.ch : 0,
        lineNumber === maxLine ? cursorTo.ch : line.length - 1
      );
    }

    if (copiedLine.match(/^\s*$/)) {
      copiedLines.push(copiedLine);
      updatedLines.push(line);
      continue;
    }

    if (copy === CopyTypes.SeparateLines || lineNumber === minLine) {
      // Does the line already have a block ID?
      const blockID = line.match(blockIDRegex);
      let link = "";
      if (blockID === null) {
        // There is NOT an existing line ID:
        newID = `^${genID()}`;
        link = view.app.fileManager.generateMarkdownLink(
          file,
          "/",
          `#${newID}`,
          settings.linkText
        );
        line = line.replace(/ ?$/, ` ${newID}`);
        if (copy === CopyTypes.LinkOnly || copy === CopyTypes.LinkOnlyEmbed) {
          copiedLine = (copy === CopyTypes.LinkOnlyEmbed ? "!" : "") + link;
        } else {
          copiedLine = copiedLine.replace(
            new RegExp(settings.lineFormatFrom, "u"),
            settings.lineFormatTo.replace("{{LINK}}", link)
          );
        }
      } else {
        // There IS an existing line ID:
        link = view.app.fileManager.generateMarkdownLink(
          file,
          "/",
          `#${blockID}`,
          settings.linkText
        );
        if (copy === CopyTypes.LinkOnly || copy === CopyTypes.LinkOnlyEmbed) {
          copiedLine = (copy === CopyTypes.LinkOnlyEmbed ? "!" : "") + link;
        } else {
          copiedLine = copiedLine
            .replace(blockIDRegex, "")
            .replace(
              new RegExp(settings.lineFormatFrom, "u"),
              settings.lineFormatTo.replace("{{LINK}}", link)
            );
        }
      }
    }

    copiedLines.push(copiedLine);
    updatedLines.push(line);
  }

  navigator.clipboard.writeText(copiedLines.join("\n")).then(() => {
    new Notice("Copied");
  });

  transaction.changes?.push({
    from: { line: minLine, ch: 0 },
    to: { line: maxLine, ch: editor.getLine(maxLine).length },
    text: updatedLines.join("\n"),
  });
  transaction.selection = { from: cursorFrom, to: cursorTo };
  editor.transaction(transaction);
};

export default class CarryForwardPlugin extends Plugin {
  settings: CarryForwardPluginSettings;

  async onload() {
    console.log("loading carry-forward-line plugin");

    await this.loadSettings();

    this.addCommand({
      id: "carry-line-forward-separate-lines",
      name: "Copy selection with each line linked to its copied source",
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
      name: "Copy selection with first line linked to its copied source",
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
      name: "Copy link to line",
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

    this.addCommand({
      id: "carry-line-forward-embed-link-only",
      name: "Copy embed link to line",
      editorCheckCallback: (checking: boolean, editor: Editor, view: View) => {
        return copyForwardLines(
          checking,
          editor,
          view,
          this.app,
          this.settings,
          CopyTypes.LinkOnlyEmbed
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

const validateRegex = (
  regexString: string
): { valid: boolean | null; string: string } => {
  let updatedRegexString = regexString
    // Because the plugin's settings are stored in JSON, characters like
    // \n get double-escaped, and then do not get replaced automatically
    // on use. This was causing To strings not to parse \n, etc.
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");

  try {
    new RegExp(updatedRegexString, "u");
    return { valid: true, string: updatedRegexString };
  } catch (e) {
    return {
      valid: false,
      string: `"${updatedRegexString}": "${e}"`,
    };
  }
};

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
      .addText((text) => {
        const settings = this.plugin.settings;
        text.setValue(settings.linkText).onChange(async (value) => {
          settings.linkText = value;
          await this.plugin.saveSettings();
        });
      });

    const fromToEl = containerEl.createEl("div");
    fromToEl.addClass("from-to-rule");

    if (validateRegex(this.plugin.settings.lineFormatFrom).valid !== true) {
      fromToEl.addClass("invalid");
    }

    new Setting(fromToEl)
      .setName("Transform Line")
      .setDesc(
        "When copying a line, replace the first match of a Regular Expression with text. Use {{LINK}} in the To field to place a link."
      )
      .addText((text) =>
        text
          .setPlaceholder("From (Default: $ / End of line)")
          .setValue(this.plugin.settings.lineFormatFrom)
          .onChange(async (value) => {
            if (value === "") {
              this.plugin.settings.lineFormatFrom =
                DEFAULT_SETTINGS.lineFormatFrom;
            } else {
              if (validateRegex(value).valid !== true) {
                fromToEl.addClass("invalid");
              } else {
                fromToEl.removeClass("invalid");
              }
              this.plugin.settings.lineFormatFrom = value;
            }
            await this.plugin.saveSettings();
          })
      )
      .addText((text) =>
        text
          .setPlaceholder("To (Default: {{LINK}})")
          .setValue(this.plugin.settings.lineFormatTo)
          .onChange(async (value) => {
            if (value === "") {
              this.plugin.settings.lineFormatTo = DEFAULT_SETTINGS.lineFormatTo;
            } else {
              this.plugin.settings.lineFormatTo = value;
            }
            await this.plugin.saveSettings();
          })
      );
  }
}
