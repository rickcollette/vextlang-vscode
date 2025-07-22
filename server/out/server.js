"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const parser_1 = require("./parser/parser");
const analyzer_1 = require("./semantic/analyzer");
const symbolTable_1 = require("./semantic/symbolTable");
const stdlibLoader_1 = require("./semantic/stdlibLoader");
const formatter_1 = require("./formatter/formatter");
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a text document manager.
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
// Initialize parser and semantic analyzer
const parser = new parser_1.Parser();
const symbolTable = new symbolTable_1.SymbolTable();
const analyzer = new analyzer_1.SemanticAnalyzer();
const stdlibLoader = new stdlibLoader_1.StdlibLoader();
const formatter = new formatter_1.Formatter({ tabSize: 4, insertSpaces: true });
// Load standard library symbols
stdlibLoader.loadStdlib(symbolTable);
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', ':', '(', '<', ' ']
            },
            // Tell the client that this server supports hover.
            hoverProvider: true,
            // Tell the client that this server supports signature help.
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            },
            // Tell the client that this server supports go to definition.
            definitionProvider: true,
            // Tell the client that this server supports find references.
            referencesProvider: true,
            // Tell the client that this server supports rename.
            renameProvider: true,
            // Tell the client that this server supports document symbols.
            documentSymbolProvider: true,
            // Tell the client that this server supports workspace symbols.
            workspaceSymbolProvider: true,
            // Tell the client that this server supports formatting.
            documentFormattingProvider: true,
            // Tell the client that this server supports folding ranges.
            foldingRangeProvider: true,
            // Tell the client that this server supports code actions.
            codeActionProvider: {
                codeActionKinds: [node_1.CodeActionKind.QuickFix, node_1.CodeActionKind.Refactor]
            },
            // Tell the client that this server supports semantic tokens.
            semanticTokensProvider: {
                legend: {
                    tokenTypes: ['class', 'function', 'variable', 'type', 'keyword', 'string', 'number', 'comment'],
                    tokenModifiers: ['declaration', 'definition', 'readonly', 'static', 'deprecated', 'abstract', 'async', 'modification', 'documentation', 'defaultLibrary']
                },
                range: true,
                full: {
                    delta: true
                }
            },
            // Tell the client that this server supports call hierarchy.
            callHierarchyProvider: true
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});
// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;
// Cache the settings of all open documents
const documentSettings = new Map();
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.vextlang || defaultSettings));
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});
function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'vextlang'
        });
        documentSettings.set(resource, result);
    }
    return result;
}
// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});
// The content of a text document has changed. This event is emitted when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
async function validateTextDocument(textDocument) {
    // In this simple example we get the settings for every validate run.
    const settings = await getDocumentSettings(textDocument.uri);
    // The validator creates diagnostics for all uppercase words length 2 and more
    const text = textDocument.getText();
    const diagnostics = [];
    try {
        // Parse the document
        const parseResult = parser.parse(text);
        // Add parse errors
        for (const parseError of parseResult.errors) {
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Error,
                range: {
                    start: { line: parseError.line - 1, character: parseError.column - 1 },
                    end: { line: parseError.line - 1, character: parseError.column }
                },
                message: parseError.message,
                source: 'vextlang'
            });
        }
        // Analyze semantics
        const semanticErrors = analyzer.analyze(parseResult.ast, textDocument.uri);
        diagnostics.push(...semanticErrors);
    }
    catch (error) {
        // Add parse error
        diagnostics.push({
            severity: node_1.DiagnosticSeverity.Error,
            range: {
                start: textDocument.positionAt(0),
                end: textDocument.positionAt(text.length)
            },
            message: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
            source: 'vextlang'
        });
    }
    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received a file change event');
});
// This handler provides the initial list of completion items.
connection.onCompletion((_textDocumentPosition) => {
    const document = documents.get(_textDocumentPosition.textDocument.uri);
    if (!document)
        return [];
    const position = _textDocumentPosition.position;
    const text = document.getText();
    const offset = document.offsetAt(position);
    // Get completions from symbol table
    const completions = symbolTable.getCompletionsAt(offset, text, document.uri);
    return completions.map(comp => ({
        label: comp.name,
        kind: comp.kind,
        detail: comp.detail,
        documentation: comp.documentation,
        insertText: comp.insertText || comp.name
    }));
});
// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    if (item.data === 1) {
        item.detail = 'TypeScript details';
        item.documentation = 'TypeScript documentation';
    }
    else if (item.data === 2) {
        item.detail = 'JavaScript details';
        item.documentation = 'JavaScript documentation';
    }
    return item;
});
// This handler provides hover information.
connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const position = params.position;
    const text = document.getText();
    const offset = document.offsetAt(position);
    const hoverInfo = symbolTable.getHoverInfoAt(offset, text, document.uri);
    if (hoverInfo) {
        return {
            contents: {
                kind: 'markdown',
                value: hoverInfo.contents
            },
            range: hoverInfo.range
        };
    }
    return null;
});
// This handler provides signature help.
connection.onSignatureHelp((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const position = params.position;
    const text = document.getText();
    const offset = document.offsetAt(position);
    const signatureInfo = symbolTable.getSignatureHelpAt(offset, text, document.uri);
    if (signatureInfo) {
        return {
            signatures: signatureInfo.signatures,
            activeSignature: signatureInfo.activeSignature,
            activeParameter: signatureInfo.activeParameter
        };
    }
    return null;
});
// This handler provides go to definition.
connection.onDefinition((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const position = params.position;
    const text = document.getText();
    const offset = document.offsetAt(position);
    const definition = symbolTable.getDefinitionAt(offset, text, document.uri);
    if (definition) {
        return {
            uri: definition.uri,
            range: definition.range
        };
    }
    return null;
});
// This handler provides find references.
connection.onReferences((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const position = params.position;
    const text = document.getText();
    const offset = document.offsetAt(position);
    return symbolTable.getReferencesAt(offset, text, document.uri);
});
// This handler provides rename.
connection.onRenameRequest((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const position = params.position;
    const text = document.getText();
    const offset = document.offsetAt(position);
    const renameInfo = symbolTable.getRenameInfoAt(offset, text, document.uri, params.newName);
    if (renameInfo) {
        return {
            changes: renameInfo.changes
        };
    }
    return null;
});
// This handler provides document symbols.
connection.onDocumentSymbol((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const text = document.getText();
    return symbolTable.getDocumentSymbols(text, document.uri);
});
// This handler provides workspace symbols.
connection.onWorkspaceSymbol((params) => {
    return symbolTable.getWorkspaceSymbols(params.query);
});
// This handler provides formatting.
connection.onDocumentFormatting((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const text = document.getText();
    const options = params.options;
    try {
        const parseResult = parser.parse(text);
        // Use the AST-based formatter
        const formattingOptions = {
            tabSize: options.tabSize,
            insertSpaces: options.insertSpaces,
            maxLineLength: 100,
            keepBlankLines: 1
        };
        const formatterInstance = new formatter_1.Formatter(formattingOptions);
        return formatterInstance.format(text, parseResult.ast);
    }
    catch (error) {
        // Fallback to simple formatting if parsing fails
        const lines = text.split('\n');
        const formattedLines = [];
        let indentLevel = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            // Decrease indent for closing braces
            if (trimmed.startsWith('}')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            // Add formatted line
            if (trimmed.length > 0) {
                formattedLines.push('    '.repeat(indentLevel) + trimmed);
            }
            else {
                formattedLines.push('');
            }
            // Increase indent for opening braces
            if (trimmed.endsWith('{')) {
                indentLevel++;
            }
        }
        const formattedText = formattedLines.join('\n');
        if (formattedText !== text) {
            return [{
                    range: {
                        start: { line: 0, character: 0 },
                        end: document.positionAt(text.length)
                    },
                    newText: formattedText
                }];
        }
        return [];
    }
});
// This handler provides folding ranges.
connection.onFoldingRanges((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const text = document.getText();
    const lines = text.split('\n');
    const ranges = [];
    let braceStack = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        // Track opening braces
        for (let j = 0; j < openBraces; j++) {
            braceStack.push(i);
        }
        // Track closing braces
        for (let j = 0; j < closeBraces; j++) {
            if (braceStack.length > 0) {
                const start = braceStack.pop();
                if (i > start) {
                    ranges.push({
                        startLine: start,
                        endLine: i,
                        kind: 'region'
                    });
                }
            }
        }
    }
    return ranges;
});
// This handler provides code actions.
connection.onCodeAction((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const actions = [];
    const diagnostics = params.context.diagnostics;
    for (const diagnostic of diagnostics) {
        if (diagnostic.message.includes('missing semicolon')) {
            actions.push({
                title: 'Add semicolon',
                kind: node_1.CodeActionKind.QuickFix,
                edit: {
                    changes: {
                        [params.textDocument.uri]: [{
                                range: diagnostic.range,
                                newText: document.getText(diagnostic.range) + ';'
                            }]
                    }
                }
            });
        }
    }
    return actions;
});
// This handler provides semantic tokens.
connection.onRequest('textDocument/semanticTokens/full', (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return { data: [] };
    const text = document.getText();
    const tokens = symbolTable.getSemanticTokens(text, document.uri);
    return {
        data: tokens
    };
});
// This handler provides call hierarchy.
connection.onRequest('callHierarchy/prepare', (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const position = params.position;
    const text = document.getText();
    const offset = document.offsetAt(position);
    return symbolTable.getCallHierarchyItemsAt(offset, text, document.uri);
});
connection.onRequest('callHierarchy/incomingCalls', (params) => {
    return symbolTable.getIncomingCalls(params.item);
});
connection.onRequest('callHierarchy/outgoingCalls', (params) => {
    return symbolTable.getOutgoingCalls(params.item);
});
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map