"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path = require("path");
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
let client;
function activate(context) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server'));
    // The debug options for the server
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    // Options to control the language client
    const clientOptions = {
        // Register the server for vex documents
        documentSelector: [{ scheme: 'file', language: 'vex' }],
        synchronize: {
            // Notify the server about file changes to .vex files in the workspace
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/*.vex')
        }
    };
    // Create the language client and start the client.
    client = new node_1.LanguageClient('vextlang', 'VextLang Language Server', serverOptions, clientOptions);
    // Start the client. This will also launch the server
    client.start();
    // Register format command
    const formatCommand = vscode_1.commands.registerCommand('vextlang.format', async () => {
        const editor = vscode_1.window.activeTextEditor;
        if (editor && editor.document.languageId === 'vex') {
            const document = editor.document;
            const formattingOptions = {
                tabSize: vscode_1.workspace.getConfiguration('vextlang').get('indentSize', 4),
                insertSpaces: true
            };
            try {
                const edits = await client.sendRequest('textDocument/formatting', {
                    textDocument: { uri: document.uri.toString() },
                    options: formattingOptions
                });
                if (edits && Array.isArray(edits) && edits.length > 0) {
                    const edit = edits[0];
                    await editor.edit((editBuilder) => {
                        editBuilder.replace(edit.range, edit.newText);
                    });
                }
            }
            catch (error) {
                console.error('Formatting failed:', error);
            }
        }
    });
    context.subscriptions.push(formatCommand);
    // Register format on save if enabled
    const formatOnSave = vscode_1.workspace.getConfiguration('vextlang').get('formatOnSave', true);
    if (formatOnSave) {
        const saveListener = vscode_1.workspace.onWillSaveTextDocument(async (event) => {
            const document = event.document;
            if (document.languageId === 'vex') {
                event.waitUntil(client.sendRequest('textDocument/formatting', {
                    textDocument: { uri: document.uri.toString() },
                    options: {
                        tabSize: vscode_1.workspace.getConfiguration('vextlang').get('indentSize', 4),
                        insertSpaces: true
                    }
                }));
            }
        });
        context.subscriptions.push(saveListener);
    }
}
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
//# sourceMappingURL=extension.js.map