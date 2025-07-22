import * as path from 'path';
import { workspace, ExtensionContext, commands, languages, TextDocument, FormattingOptions, window } from 'vscode';
import {
    LanguageClient,
    TransportKind,
    ServerOptions
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server'));

    // The debug options for the server
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    // Options to control the language client
    const clientOptions = {
        // Register the server for vex documents
        documentSelector: [{ scheme: 'file', language: 'vex' }],
        synchronize: {
            // Notify the server about file changes to .vex files in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/*.vex')
        }
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        'vextlang',
        'VextLang Language Server',
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    client.start();

    // Register format command
    const formatCommand = commands.registerCommand('vextlang.format', async () => {
        const editor = window.activeTextEditor;
        if (editor && editor.document.languageId === 'vex') {
            const document = editor.document;
            const formattingOptions: FormattingOptions = {
                tabSize: workspace.getConfiguration('vextlang').get('indentSize', 4),
                insertSpaces: true
            };

            try {
                const edits = await client.sendRequest('textDocument/formatting', {
                    textDocument: { uri: document.uri.toString() },
                    options: formattingOptions
                });

                if (edits && Array.isArray(edits) && edits.length > 0) {
                    const edit = edits[0];
                    await editor.edit((editBuilder: any) => {
                        editBuilder.replace(edit.range, edit.newText);
                    });
                }
            } catch (error) {
                console.error('Formatting failed:', error);
            }
        }
    });

    context.subscriptions.push(formatCommand);

    // Register format on save if enabled
    const formatOnSave = workspace.getConfiguration('vextlang').get('formatOnSave', true);
    if (formatOnSave) {
        const saveListener = workspace.onWillSaveTextDocument(async (event) => {
            const document = event.document;
            if (document.languageId === 'vex') {
                event.waitUntil(
                    client.sendRequest('textDocument/formatting', {
                        textDocument: { uri: document.uri.toString() },
                        options: {
                            tabSize: workspace.getConfiguration('vextlang').get('indentSize', 4),
                            insertSpaces: true
                        }
                    })
                );
            }
        });
        context.subscriptions.push(saveListener);
    }
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
} 