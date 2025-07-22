import { ASTNode, Statement, Expression, FunctionDeclaration, StructDeclaration, EnumDeclaration, VariableDeclaration } from '../parser/parser';
import { TextEdit, Range, Position } from 'vscode-languageserver/node';

export interface FormattingOptions {
    tabSize: number;
    insertSpaces: boolean;
    maxLineLength?: number;
    keepBlankLines?: number;
}

export class Formatter {
    private options: FormattingOptions;
    private indentLevel: number = 0;
    private currentLine: number = 0;
    private currentColumn: number = 0;
    private output: string = '';
    private edits: TextEdit[] = [];

    constructor(options: FormattingOptions) {
        this.options = options;
    }

    format(source: string, ast: ASTNode[]): TextEdit[] {
        this.output = '';
        this.edits = [];
        this.indentLevel = 0;
        this.currentLine = 0;
        this.currentColumn = 0;

        // Format each top-level node
        for (const node of ast) {
            this.formatNode(node);
        }

        // Create the final edit
        const fullRange = {
            start: { line: 0, character: 0 },
            end: { line: this.countLines(source), character: source.length }
        };

        this.edits.push({
            range: fullRange,
            newText: this.output
        });

        return this.edits;
    }

    private formatNode(node: ASTNode): void {
        switch (node.type) {
            case 'function':
                this.formatFunction(node as FunctionDeclaration);
                break;
            case 'struct':
                this.formatStruct(node as StructDeclaration);
                break;
            case 'enum':
                this.formatEnum(node as EnumDeclaration);
                break;
            case 'variable':
                this.formatVariable(node as VariableDeclaration);
                break;
            case 'statement':
                this.formatStatement(node as Statement);
                break;
        }
    }

    private formatFunction(func: FunctionDeclaration): void {
        // Function declaration
        this.writeIndent();

        if (func.isAsync) {
            this.write('async ');
        }

        this.write(`fn ${func.name}(`);

        // Parameters
        for (let i = 0; i < func.parameters.length; i++) {
            const param = func.parameters[i];
            this.write(`${param.name}: `);
            this.formatTypeExpression(param.type);

            if (i < func.parameters.length - 1) {
                this.write(', ');
            }
        }

        this.write(')');

        // Return type
        if (func.returnType) {
            this.write(' -> ');
            this.formatTypeExpression(func.returnType);
        }

        this.write(' {\n');

        // Function body
        this.indentLevel++;
        for (const stmt of func.body) {
            this.formatStatement(stmt);
        }
        this.indentLevel--;

        this.writeIndent();
        this.write('}\n\n');
    }

    private formatStruct(struct: StructDeclaration): void {
        this.writeIndent();
        this.write(`struct ${struct.name}`);

        // Generic parameters
        if (struct.generics && struct.generics.length > 0) {
            this.write('<');
            for (let i = 0; i < struct.generics.length; i++) {
                const generic = struct.generics[i];
                this.write(generic.name);
                if (generic.constraint) {
                    this.write(': ');
                    this.formatTypeExpression(generic.constraint);
                }
                if (i < struct.generics.length - 1) {
                    this.write(', ');
                }
            }
            this.write('>');
        }

        this.write(' {\n');

        // Fields
        this.indentLevel++;
        for (let i = 0; i < struct.fields.length; i++) {
            const field = struct.fields[i];
            this.writeIndent();
            this.write(`${field.name}: `);
            this.formatTypeExpression(field.type);

            if (i < struct.fields.length - 1) {
                this.write(',');
            }
            this.write('\n');
        }
        this.indentLevel--;

        this.writeIndent();
        this.write('}\n\n');
    }

    private formatEnum(enumDecl: EnumDeclaration): void {
        this.writeIndent();
        this.write(`enum ${enumDecl.name}`);

        // Generic parameters
        if (enumDecl.generics && enumDecl.generics.length > 0) {
            this.write('<');
            for (let i = 0; i < enumDecl.generics.length; i++) {
                const generic = enumDecl.generics[i];
                this.write(generic.name);
                if (generic.constraint) {
                    this.write(': ');
                    this.formatTypeExpression(generic.constraint);
                }
                if (i < enumDecl.generics.length - 1) {
                    this.write(', ');
                }
            }
            this.write('>');
        }

        this.write(' {\n');

        // Variants
        this.indentLevel++;
        for (let i = 0; i < enumDecl.variants.length; i++) {
            const variant = enumDecl.variants[i];
            this.writeIndent();
            this.write(variant.name);

            if (variant.fields && variant.fields.length > 0) {
                this.write('(');
                for (let j = 0; j < variant.fields.length; j++) {
                    const field = variant.fields[j];
                    this.write(`${field.name}: `);
                    this.formatTypeExpression(field.type);
                    if (j < variant.fields.length - 1) {
                        this.write(', ');
                    }
                }
                this.write(')');
            }

            if (i < enumDecl.variants.length - 1) {
                this.write(',');
            }
            this.write('\n');
        }
        this.indentLevel--;

        this.writeIndent();
        this.write('}\n\n');
    }

    private formatVariable(variable: VariableDeclaration): void {
        this.writeIndent();

        if (variable.isConst) {
            this.write('const ');
        } else {
            this.write('let ');
        }

        this.write(variable.name);

        if (variable.type) {
            this.write(': ');
            this.formatTypeExpression(variable.type);
        }

        if (variable.value) {
            this.write(' = ');
            this.formatExpression(variable.value);
        }

        this.write(';\n');
    }

    private formatStatement(stmt: Statement): void {
        switch (stmt.kind) {
            case 'expression':
                if (stmt.expression) {
                    this.writeIndent();
                    this.formatExpression(stmt.expression);
                    this.write(';\n');
                }
                break;
            case 'if':
                this.formatIfStatement(stmt);
                break;
            case 'for':
                this.formatForStatement(stmt);
                break;
            case 'while':
                this.formatWhileStatement(stmt);
                break;
            case 'match':
                this.formatMatchStatement(stmt);
                break;
            case 'return':
                this.writeIndent();
                this.write('return');
                if (stmt.value) {
                    this.write(' ');
                    this.formatExpression(stmt.value);
                }
                this.write(';\n');
                break;
            case 'break':
                this.writeIndent();
                this.write('break;\n');
                break;
            case 'continue':
                this.writeIndent();
                this.write('continue;\n');
                break;
            case 'function':
                if (stmt.parameters && stmt.name) {
                    this.formatFunction({
                        type: 'function',
                        name: stmt.name,
                        parameters: stmt.parameters,
                        returnType: stmt.returnType,
                        body: [],
                        isAsync: false,
                        range: stmt.range,
                        line: stmt.line,
                        column: stmt.column
                    });
                }
                break;
            case 'struct':
                if (stmt.fields && stmt.name) {
                    this.formatStruct({
                        type: 'struct',
                        name: stmt.name,
                        fields: stmt.fields,
                        range: stmt.range,
                        line: stmt.line,
                        column: stmt.column
                    });
                }
                break;
            case 'enum':
                if (stmt.variants && stmt.name) {
                    this.formatEnum({
                        type: 'enum',
                        name: stmt.name,
                        variants: stmt.variants,
                        range: stmt.range,
                        line: stmt.line,
                        column: stmt.column
                    });
                }
                break;
        }
    }

    private formatIfStatement(stmt: Statement): void {
        this.writeIndent();
        this.write('if (');
        if (stmt.condition) {
            this.formatExpression(stmt.condition);
        }
        this.write(') {\n');

        if (stmt.thenBody) {
            this.indentLevel++;
            for (const bodyStmt of stmt.thenBody) {
                this.formatStatement(bodyStmt);
            }
            this.indentLevel--;
        }

        this.writeIndent();
        this.write('}');

        if (stmt.elseBody && stmt.elseBody.length > 0) {
            this.write(' else {\n');
            this.indentLevel++;
            for (const bodyStmt of stmt.elseBody) {
                this.formatStatement(bodyStmt);
            }
            this.indentLevel--;
            this.writeIndent();
            this.write('}');
        }

        this.write('\n');
    }

    private formatForStatement(stmt: Statement): void {
        this.writeIndent();
        this.write('for ');
        if (stmt.item) {
            this.write(stmt.item);
        }
        this.write(' in ');
        if (stmt.collection) {
            this.formatExpression(stmt.collection);
        }
        this.write(' {\n');

        if (stmt.body) {
            this.indentLevel++;
            for (const bodyStmt of stmt.body) {
                this.formatStatement(bodyStmt);
            }
            this.indentLevel--;
        }

        this.writeIndent();
        this.write('}\n');
    }

    private formatWhileStatement(stmt: Statement): void {
        this.writeIndent();
        this.write('while (');
        if (stmt.condition) {
            this.formatExpression(stmt.condition);
        }
        this.write(') {\n');

        if (stmt.body) {
            this.indentLevel++;
            for (const bodyStmt of stmt.body) {
                this.formatStatement(bodyStmt);
            }
            this.indentLevel--;
        }

        this.writeIndent();
        this.write('}\n');
    }

    private formatMatchStatement(stmt: Statement): void {
        this.writeIndent();
        this.write('match ');
        if (stmt.expression) {
            this.formatExpression(stmt.expression);
        }
        this.write(' {\n');

        if (stmt.cases) {
            this.indentLevel++;
            for (let i = 0; i < stmt.cases.length; i++) {
                const matchCase = stmt.cases[i];
                this.writeIndent();
                this.formatExpression(matchCase.pattern);

                if (matchCase.guard) {
                    this.write(' if ');
                    this.formatExpression(matchCase.guard);
                }

                this.write(' => {\n');

                this.indentLevel++;
                for (const bodyStmt of matchCase.body) {
                    this.formatStatement(bodyStmt);
                }
                this.indentLevel--;

                this.writeIndent();
                this.write('}');

                if (i < stmt.cases.length - 1) {
                    this.write(',');
                }
                this.write('\n');
            }
            this.indentLevel--;
        }

        this.writeIndent();
        this.write('}\n');
    }

    private formatExpression(expr: Expression): void {
        switch (expr.kind) {
            case 'literal':
                this.write(expr.value as string);
                break;
            case 'identifier':
                this.write(expr.value as string);
                break;
            case 'binary':
                if (expr.left) {
                    this.formatExpression(expr.left);
                }
                this.write(` ${expr.operator} `);
                if (expr.right) {
                    this.formatExpression(expr.right);
                }
                break;
            case 'unary':
                this.write(expr.operator || '');
                if (expr.right) {
                    this.formatExpression(expr.right);
                }
                break;
            case 'call':
                if (expr.left) {
                    this.formatExpression(expr.left);
                }
                this.write('(');
                if (expr.value) {
                    const args = expr.value as Expression[];
                    for (let i = 0; i < args.length; i++) {
                        this.formatExpression(args[i]);
                        if (i < args.length - 1) {
                            this.write(', ');
                        }
                    }
                }
                this.write(')');
                break;
            case 'member_access':
                if (expr.left) {
                    this.formatExpression(expr.left);
                }
                this.write('.');
                this.write(expr.value as string);
                break;
            case 'index_access':
                if (expr.left) {
                    this.formatExpression(expr.left);
                }
                this.write('[');
                if (expr.right) {
                    this.formatExpression(expr.right);
                }
                this.write(']');
                break;
            case 'parenthesized':
                this.write('(');
                if (expr.value) {
                    this.formatExpression(expr.value as Expression);
                }
                this.write(')');
                break;
            case 'array':
                this.write('[');
                if (expr.value) {
                    const elements = expr.value as Expression[];
                    for (let i = 0; i < elements.length; i++) {
                        this.formatExpression(elements[i]);
                        if (i < elements.length - 1) {
                            this.write(', ');
                        }
                    }
                }
                this.write(']');
                break;
            case 'block':
                this.write('{\n');
                if (expr.value) {
                    const statements = expr.value as Statement[];
                    this.indentLevel++;
                    for (const stmt of statements) {
                        this.formatStatement(stmt);
                    }
                    this.indentLevel--;
                }
                this.writeIndent();
                this.write('}');
                break;
        }
    }

    private formatTypeExpression(typeExpr: any): void {
        if (typeExpr.isReference) {
            this.write('&');
            if (typeExpr.isMutable) {
                this.write('mut ');
            }
        }

        this.write(typeExpr.baseType);

        if (typeExpr.genericArgs && typeExpr.genericArgs.length > 0) {
            this.write('<');
            for (let i = 0; i < typeExpr.genericArgs.length; i++) {
                this.formatTypeExpression(typeExpr.genericArgs[i]);
                if (i < typeExpr.genericArgs.length - 1) {
                    this.write(', ');
                }
            }
            this.write('>');
        }
    }

    private writeIndent(): void {
        const indent = this.options.insertSpaces
            ? ' '.repeat(this.indentLevel * this.options.tabSize)
            : '\t'.repeat(this.indentLevel);
        this.write(indent);
    }

    private write(text: string): void {
        this.output += text;

        // Update position tracking
        const lines = text.split('\n');
        if (lines.length > 1) {
            this.currentLine += lines.length - 1;
            this.currentColumn = lines[lines.length - 1].length;
        } else {
            this.currentColumn += text.length;
        }
    }

    private countLines(text: string): number {
        return text.split('\n').length;
    }
} 