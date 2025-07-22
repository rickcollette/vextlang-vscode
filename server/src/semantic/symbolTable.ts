import { CompletionItem, CompletionItemKind, Hover, SignatureHelp, Location, Range, Position, DocumentSymbol, SymbolKind, WorkspaceEdit, CallHierarchyItem, CallHierarchyIncomingCall, CallHierarchyOutgoingCall } from 'vscode-languageserver';

export interface Symbol {
    name: string;
    kind: CompletionItemKind;
    uri: string;
    range: Range;
    detail?: string;
    documentation?: string;
    type?: string;
    parameters?: string[];
    returnType?: string;
}

export interface CompletionInfo {
    name: string;
    kind: CompletionItemKind;
    detail?: string;
    documentation?: string;
    insertText?: string;
}

export interface HoverInfo {
    contents: string;
    range: Range;
}

export interface SignatureInfo {
    signatures: any[];
    activeSignature: number;
    activeParameter: number;
}

export interface RenameInfo {
    changes: { [uri: string]: any[] };
}

export class SymbolTable {
    private symbols: Map<string, Symbol> = new Map();
    private globalSymbols: Map<string, Symbol> = new Map();

    addSymbol(symbol: Symbol): void {
        const key = `${symbol.uri}:${symbol.name}`;
        this.symbols.set(key, symbol);
    }

    addGlobalSymbol(symbol: Symbol): void {
        this.globalSymbols.set(symbol.name, symbol);
    }

    getSymbol(name: string, uri: string): Symbol | undefined {
        const key = `${uri}:${name}`;
        return this.symbols.get(key) || this.globalSymbols.get(name);
    }

    getCompletionsAt(offset: number, text: string, uri: string): CompletionInfo[] {
        const completions: CompletionInfo[] = [];

        // Add keywords
        const keywords = [
            'fn', 'let', 'const', 'struct', 'enum', 'if', 'else', 'for', 'while',
            'break', 'continue', 'return', 'match', 'where', 'async', 'await',
            'trait', 'impl', 'import', 'package'
        ];

        for (const keyword of keywords) {
            completions.push({
                name: keyword,
                kind: CompletionItemKind.Keyword,
                detail: `Keyword: ${keyword}`
            });
        }

        // Add primitive types
        const primitiveTypes = ['int', 'float', 'bool', 'string', 'char'];
        for (const type of primitiveTypes) {
            completions.push({
                name: type,
                kind: CompletionItemKind.TypeParameter,
                detail: `Primitive type: ${type}`
            });
        }

        // Add generic types
        const genericTypes = ['Option', 'Result', 'Vec'];
        for (const type of genericTypes) {
            completions.push({
                name: type,
                kind: CompletionItemKind.TypeParameter,
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

    getHoverInfoAt(offset: number, text: string, uri: string): HoverInfo | null {
        const word = this.getWordAtOffset(offset, text);
        if (!word) return null;

        const symbol = this.getSymbol(word, uri);
        if (!symbol) return null;

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

    getSignatureHelpAt(offset: number, text: string, uri: string): SignatureInfo | null {
        // Find function call at current position
        const word = this.getWordAtOffset(offset, text);
        if (!word) return null;

        const symbol = this.getSymbol(word, uri);
        if (!symbol || symbol.kind !== CompletionItemKind.Function) return null;

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

    getDefinitionAt(offset: number, text: string, uri: string): Location | null {
        const word = this.getWordAtOffset(offset, text);
        if (!word) return null;

        const symbol = this.getSymbol(word, uri);
        if (!symbol) return null;

        return {
            uri: symbol.uri,
            range: symbol.range
        };
    }

    getReferencesAt(offset: number, text: string, uri: string): Location[] {
        const word = this.getWordAtOffset(offset, text);
        if (!word) return [];

        const references: Location[] = [];

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

    getRenameInfoAt(offset: number, text: string, uri: string, newName: string): RenameInfo | null {
        const word = this.getWordAtOffset(offset, text);
        if (!word) return null;

        const changes: { [uri: string]: any[] } = {};

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

    getDocumentSymbols(text: string, uri: string): DocumentSymbol[] {
        const symbols: DocumentSymbol[] = [];

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

    getWorkspaceSymbols(query: string): any[] {
        const symbols: any[] = [];

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

    getSemanticTokens(text: string, uri: string): number[] {
        const tokens: number[] = [];
        const lines = text.split('\n');

        for (let line = 0; line < lines.length; line++) {
            const lineText = lines[line];
            const words = lineText.split(/\s+/);
            let char = 0;

            for (const word of words) {
                if (word.length > 0) {
                    const symbol = this.getSymbol(word, uri);
                    if (symbol) {
                        tokens.push(
                            line,                    // line
                            char,                    // start character
                            word.length,             // length
                            this.getTokenType(symbol.kind), // token type
                            0                        // token modifiers
                        );
                    }
                }
                char += word.length + 1; // +1 for space
            }
        }

        return tokens;
    }

    getCallHierarchyItemsAt(offset: number, text: string, uri: string): CallHierarchyItem[] {
        const word = this.getWordAtOffset(offset, text);
        if (!word) return [];

        const symbol = this.getSymbol(word, uri);
        if (!symbol || symbol.kind !== CompletionItemKind.Function) return [];

        return [{
            name: symbol.name,
            kind: this.mapCompletionKindToSymbolKind(symbol.kind),
            uri: symbol.uri,
            range: symbol.range,
            selectionRange: symbol.range
        }];
    }

    getIncomingCalls(item: CallHierarchyItem): CallHierarchyIncomingCall[] {
        // This would require more sophisticated analysis
        // For now, return empty array
        return [];
    }

    getOutgoingCalls(item: CallHierarchyItem): CallHierarchyOutgoingCall[] {
        // This would require more sophisticated analysis
        // For now, return empty array
        return [];
    }

    private getWordAtOffset(offset: number, text: string): string | null {
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

    private createRangeFromOffset(offset: number, length: number): Range {
        // This is a simplified range creation - in a real implementation,
        // you'd need to convert character offsets to line/character positions
        return {
            start: { line: 0, character: offset },
            end: { line: 0, character: offset + length }
        };
    }

    private mapCompletionKindToSymbolKind(kind: CompletionItemKind): SymbolKind {
        switch (kind) {
            case CompletionItemKind.Function:
                return SymbolKind.Function;
            case CompletionItemKind.Variable:
                return SymbolKind.Variable;
            case CompletionItemKind.Class:
                return SymbolKind.Class;
            case CompletionItemKind.TypeParameter:
                return SymbolKind.TypeParameter;
            case CompletionItemKind.Module:
                return SymbolKind.Module;
            case CompletionItemKind.Property:
                return SymbolKind.Property;
            case CompletionItemKind.Field:
                return SymbolKind.Field;
            case CompletionItemKind.Constructor:
                return SymbolKind.Constructor;
            case CompletionItemKind.Enum:
                return SymbolKind.Enum;
            case CompletionItemKind.Interface:
                return SymbolKind.Interface;
            case CompletionItemKind.Method:
                return SymbolKind.Method;
            case CompletionItemKind.Module:
                return SymbolKind.Namespace;
            case CompletionItemKind.Module:
                return SymbolKind.Package;
            case CompletionItemKind.TypeParameter:
                return SymbolKind.TypeParameter;
            default:
                return SymbolKind.Variable;
        }
    }

    private getTokenType(kind: CompletionItemKind): number {
        switch (kind) {
            case CompletionItemKind.Function:
                return 1; // function
            case CompletionItemKind.Variable:
                return 2; // variable
            case CompletionItemKind.Class:
                return 0; // class
            case CompletionItemKind.TypeParameter:
                return 3; // type
            case CompletionItemKind.Keyword:
                return 4; // keyword
            case CompletionItemKind.Text:
                return 5; // string
            case CompletionItemKind.Value:
                return 6; // number
            case CompletionItemKind.Text:
                return 7; // comment
            default:
                return 2; // variable
        }
    }
} 