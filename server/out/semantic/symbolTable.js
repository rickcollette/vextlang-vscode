"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolTable = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
class SymbolTable {
    constructor() {
        this.symbols = new Map();
        this.globalSymbols = new Map();
    }
    addSymbol(symbol) {
        const key = `${symbol.uri}:${symbol.name}`;
        this.symbols.set(key, symbol);
    }
    addGlobalSymbol(symbol) {
        this.globalSymbols.set(symbol.name, symbol);
    }
    getSymbol(name, uri) {
        const key = `${uri}:${name}`;
        return this.symbols.get(key) || this.globalSymbols.get(name);
    }
    getCompletionsAt(offset, text, uri) {
        const completions = [];
        // Add keywords
        const keywords = [
            'fn', 'let', 'const', 'struct', 'enum', 'if', 'else', 'for', 'while',
            'break', 'continue', 'return', 'match', 'where', 'async', 'await',
            'trait', 'impl', 'import', 'package'
        ];
        for (const keyword of keywords) {
            completions.push({
                name: keyword,
                kind: vscode_languageserver_1.CompletionItemKind.Keyword,
                detail: `Keyword: ${keyword}`
            });
        }
        // Add primitive types
        const primitiveTypes = ['int', 'float', 'bool', 'string', 'char'];
        for (const type of primitiveTypes) {
            completions.push({
                name: type,
                kind: vscode_languageserver_1.CompletionItemKind.TypeParameter,
                detail: `Primitive type: ${type}`
            });
        }
        // Add generic types
        const genericTypes = ['Option', 'Result', 'Vec'];
        for (const type of genericTypes) {
            completions.push({
                name: type,
                kind: vscode_languageserver_1.CompletionItemKind.TypeParameter,
                detail: `Generic type: ${type}`
            });
        }
        // Add local symbols
        for (const [key, symbol] of this.symbols) {
            if (key.startsWith(uri + ':')) {
                completions.push({
                    name: symbol.name,
                    kind: symbol.kind,
                    detail: symbol.detail,
                    documentation: symbol.documentation
                });
            }
        }
        // Add global symbols
        for (const [name, symbol] of this.globalSymbols) {
            completions.push({
                name: symbol.name,
                kind: symbol.kind,
                detail: symbol.detail,
                documentation: symbol.documentation
            });
        }
        return completions;
    }
    getHoverInfoAt(offset, text, uri) {
        const word = this.getWordAtOffset(offset, text);
        if (!word)
            return null;
        const symbol = this.getSymbol(word, uri);
        if (!symbol)
            return null;
        let contents = `**${symbol.name}**`;
        if (symbol.type) {
            contents += `\n\nType: \`${symbol.type}\``;
        }
        if (symbol.parameters) {
            contents += `\n\nParameters: \`${symbol.parameters.join(', ')}\``;
        }
        if (symbol.returnType) {
            contents += `\n\nReturns: \`${symbol.returnType}\``;
        }
        if (symbol.documentation) {
            contents += `\n\n${symbol.documentation}`;
        }
        return {
            contents,
            range: this.createRangeFromOffset(offset, word.length)
        };
    }
    getSignatureHelpAt(offset, text, uri) {
        // Find function call at current position
        const word = this.getWordAtOffset(offset, text);
        if (!word)
            return null;
        const symbol = this.getSymbol(word, uri);
        if (!symbol || symbol.kind !== vscode_languageserver_1.CompletionItemKind.Function)
            return null;
        const signatures = [{
                label: `${symbol.name}(${symbol.parameters?.join(', ') || ''})`,
                documentation: symbol.documentation,
                parameters: symbol.parameters?.map(p => ({ label: p })) || []
            }];
        return {
            signatures,
            activeSignature: 0,
            activeParameter: 0
        };
    }
    getDefinitionAt(offset, text, uri) {
        const word = this.getWordAtOffset(offset, text);
        if (!word)
            return null;
        const symbol = this.getSymbol(word, uri);
        if (!symbol)
            return null;
        return {
            uri: symbol.uri,
            range: symbol.range
        };
    }
    getReferencesAt(offset, text, uri) {
        const word = this.getWordAtOffset(offset, text);
        if (!word)
            return [];
        const references = [];
        // Find all occurrences of this symbol
        for (const [key, symbol] of this.symbols) {
            if (symbol.name === word) {
                references.push({
                    uri: symbol.uri,
                    range: symbol.range
                });
            }
        }
        // Add global symbol if it matches
        const globalSymbol = this.globalSymbols.get(word);
        if (globalSymbol) {
            references.push({
                uri: globalSymbol.uri,
                range: globalSymbol.range
            });
        }
        return references;
    }
    getRenameInfoAt(offset, text, uri, newName) {
        const word = this.getWordAtOffset(offset, text);
        if (!word)
            return null;
        const changes = {};
        // Find all occurrences and create edits
        for (const [key, symbol] of this.symbols) {
            if (symbol.name === word) {
                if (!changes[symbol.uri]) {
                    changes[symbol.uri] = [];
                }
                changes[symbol.uri].push({
                    range: symbol.range,
                    newText: newName
                });
            }
        }
        // Add global symbol if it matches
        const globalSymbol = this.globalSymbols.get(word);
        if (globalSymbol) {
            if (!changes[globalSymbol.uri]) {
                changes[globalSymbol.uri] = [];
            }
            changes[globalSymbol.uri].push({
                range: globalSymbol.range,
                newText: newName
            });
        }
        return { changes };
    }
    getDocumentSymbols(text, uri) {
        const symbols = [];
        // Find all symbols in this document
        for (const [key, symbol] of this.symbols) {
            if (key.startsWith(uri + ':')) {
                symbols.push({
                    name: symbol.name,
                    kind: this.mapCompletionKindToSymbolKind(symbol.kind),
                    range: symbol.range,
                    selectionRange: symbol.range,
                    detail: symbol.detail,
                    children: []
                });
            }
        }
        return symbols;
    }
    getWorkspaceSymbols(query) {
        const symbols = [];
        // Add local symbols
        for (const [key, symbol] of this.symbols) {
            if (symbol.name.toLowerCase().includes(query.toLowerCase())) {
                symbols.push({
                    name: symbol.name,
                    kind: this.mapCompletionKindToSymbolKind(symbol.kind),
                    location: {
                        uri: symbol.uri,
                        range: symbol.range
                    }
                });
            }
        }
        // Add global symbols
        for (const [name, symbol] of this.globalSymbols) {
            if (symbol.name.toLowerCase().includes(query.toLowerCase())) {
                symbols.push({
                    name: symbol.name,
                    kind: this.mapCompletionKindToSymbolKind(symbol.kind),
                    location: {
                        uri: symbol.uri,
                        range: symbol.range
                    }
                });
            }
        }
        return symbols;
    }
    getSemanticTokens(text, uri) {
        const tokens = [];
        const lines = text.split('\n');
        for (let line = 0; line < lines.length; line++) {
            const lineText = lines[line];
            const words = lineText.split(/\s+/);
            let char = 0;
            for (const word of words) {
                if (word.length > 0) {
                    const symbol = this.getSymbol(word, uri);
                    if (symbol) {
                        tokens.push(line, // line
                        char, // start character
                        word.length, // length
                        this.getTokenType(symbol.kind), // token type
                        0 // token modifiers
                        );
                    }
                }
                char += word.length + 1; // +1 for space
            }
        }
        return tokens;
    }
    getCallHierarchyItemsAt(offset, text, uri) {
        const word = this.getWordAtOffset(offset, text);
        if (!word)
            return [];
        const symbol = this.getSymbol(word, uri);
        if (!symbol || symbol.kind !== vscode_languageserver_1.CompletionItemKind.Function)
            return [];
        return [{
                name: symbol.name,
                kind: this.mapCompletionKindToSymbolKind(symbol.kind),
                uri: symbol.uri,
                range: symbol.range,
                selectionRange: symbol.range
            }];
    }
    getIncomingCalls(item) {
        // This would require more sophisticated analysis
        // For now, return empty array
        return [];
    }
    getOutgoingCalls(item) {
        // This would require more sophisticated analysis
        // For now, return empty array
        return [];
    }
    getWordAtOffset(offset, text) {
        // Simple word extraction - in a real implementation, this would be more sophisticated
        const before = text.substring(0, offset);
        const after = text.substring(offset);
        const beforeMatch = before.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
        const afterMatch = after.match(/^[a-zA-Z0-9_]*/);
        if (beforeMatch && afterMatch) {
            return beforeMatch[0] + afterMatch[0];
        }
        return null;
    }
    createRangeFromOffset(offset, length) {
        // This is a simplified range creation - in a real implementation,
        // you'd need to convert character offsets to line/character positions
        return {
            start: { line: 0, character: offset },
            end: { line: 0, character: offset + length }
        };
    }
    mapCompletionKindToSymbolKind(kind) {
        switch (kind) {
            case vscode_languageserver_1.CompletionItemKind.Function:
                return vscode_languageserver_1.SymbolKind.Function;
            case vscode_languageserver_1.CompletionItemKind.Variable:
                return vscode_languageserver_1.SymbolKind.Variable;
            case vscode_languageserver_1.CompletionItemKind.Class:
                return vscode_languageserver_1.SymbolKind.Class;
            case vscode_languageserver_1.CompletionItemKind.TypeParameter:
                return vscode_languageserver_1.SymbolKind.TypeParameter;
            case vscode_languageserver_1.CompletionItemKind.Module:
                return vscode_languageserver_1.SymbolKind.Module;
            case vscode_languageserver_1.CompletionItemKind.Property:
                return vscode_languageserver_1.SymbolKind.Property;
            case vscode_languageserver_1.CompletionItemKind.Field:
                return vscode_languageserver_1.SymbolKind.Field;
            case vscode_languageserver_1.CompletionItemKind.Constructor:
                return vscode_languageserver_1.SymbolKind.Constructor;
            case vscode_languageserver_1.CompletionItemKind.Enum:
                return vscode_languageserver_1.SymbolKind.Enum;
            case vscode_languageserver_1.CompletionItemKind.Interface:
                return vscode_languageserver_1.SymbolKind.Interface;
            case vscode_languageserver_1.CompletionItemKind.Method:
                return vscode_languageserver_1.SymbolKind.Method;
            case vscode_languageserver_1.CompletionItemKind.Module:
                return vscode_languageserver_1.SymbolKind.Namespace;
            case vscode_languageserver_1.CompletionItemKind.Module:
                return vscode_languageserver_1.SymbolKind.Package;
            case vscode_languageserver_1.CompletionItemKind.TypeParameter:
                return vscode_languageserver_1.SymbolKind.TypeParameter;
            default:
                return vscode_languageserver_1.SymbolKind.Variable;
        }
    }
    getTokenType(kind) {
        switch (kind) {
            case vscode_languageserver_1.CompletionItemKind.Function:
                return 1; // function
            case vscode_languageserver_1.CompletionItemKind.Variable:
                return 2; // variable
            case vscode_languageserver_1.CompletionItemKind.Class:
                return 0; // class
            case vscode_languageserver_1.CompletionItemKind.TypeParameter:
                return 3; // type
            case vscode_languageserver_1.CompletionItemKind.Keyword:
                return 4; // keyword
            case vscode_languageserver_1.CompletionItemKind.Text:
                return 5; // string
            case vscode_languageserver_1.CompletionItemKind.Value:
                return 6; // number
            case vscode_languageserver_1.CompletionItemKind.Text:
                return 7; // comment
            default:
                return 2; // variable
        }
    }
}
exports.SymbolTable = SymbolTable;
//# sourceMappingURL=symbolTable.js.map