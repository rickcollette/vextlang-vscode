import { ASTNode, FunctionDeclaration, StructDeclaration, EnumDeclaration, VariableDeclaration, Statement, Expression, TypeExpression, Parameter, Field, EnumVariant } from '../parser/parser';
import { Diagnostic, DiagnosticSeverity, Range, Position } from 'vscode-languageserver/node';
import { TypeChecker } from './typeChecker';

export interface SemanticError {
    message: string;
    range: Range;
    severity: DiagnosticSeverity;
    code?: string;
}

export class SemanticAnalyzer {
    private errors: SemanticError[] = [];
    private symbolTable: Map<string, SymbolInfo> = new Map();
    private currentScope: string[] = [];
    private functionScopes: Map<string, Set<string>> = new Map();
    private typeChecker: TypeChecker;

    constructor() {
        this.typeChecker = new TypeChecker();
    }

    analyze(ast: ASTNode[], uri: string): Diagnostic[] {
        this.errors = [];
        this.symbolTable.clear();
        this.currentScope = [];
        this.functionScopes.clear();

        // First pass: collect all declarations
        for (const node of ast) {
            this.collectDeclarations(node, uri);
        }

        // Second pass: analyze semantics
        for (const node of ast) {
            this.analyzeNode(node, uri);
        }

        // Third pass: type checking
        const typeErrors = this.typeChecker.checkTypes(ast, uri);
        for (const typeError of typeErrors) {
            this.errors.push({
                message: typeError.message,
                range: {
                    start: { line: typeError.line - 1, character: typeError.column - 1 },
                    end: { line: typeError.line - 1, character: typeError.column }
                },
                severity: DiagnosticSeverity.Error,
                code: 'type_error'
            });
        }

        return this.errors.map(error => ({
            severity: error.severity,
            range: error.range,
            message: error.message,
            source: 'vextlang',
            code: error.code
        }));
    }

    private collectDeclarations(node: ASTNode, uri: string): void {
        switch (node.type) {
            case 'function':
                this.collectFunctionDeclaration(node as FunctionDeclaration, uri);
                break;
            case 'struct':
                this.collectStructDeclaration(node as StructDeclaration, uri);
                break;
            case 'enum':
                this.collectEnumDeclaration(node as EnumDeclaration, uri);
                break;
            case 'variable':
                this.collectVariableDeclaration(node as VariableDeclaration, uri);
                break;
            case 'statement':
                this.collectStatementDeclarations(node as Statement, uri);
                break;
        }
    }

    private collectFunctionDeclaration(func: FunctionDeclaration, uri: string): void {
        const symbolKey = `${uri}:${func.name}`;

        // Check for duplicate function declarations
        if (this.symbolTable.has(symbolKey)) {
            this.addError(
                `Function '${func.name}' is already declared`,
                func.range,
                DiagnosticSeverity.Error,
                'duplicate_function'
            );
            return;
        }

        // Validate function name
        if (!this.isValidIdentifier(func.name)) {
            this.addError(
                `Invalid function name: '${func.name}'`,
                func.range,
                DiagnosticSeverity.Error,
                'invalid_function_name'
            );
        }

        // Collect parameter names
        const paramNames = new Set<string>();
        for (const param of func.parameters) {
            if (paramNames.has(param.name)) {
                this.addError(
                    `Duplicate parameter name: '${param.name}'`,
                    param.type.range,
                    DiagnosticSeverity.Error,
                    'duplicate_parameter'
                );
            } else {
                paramNames.add(param.name);
            }

            // Validate parameter name
            if (!this.isValidIdentifier(param.name)) {
                this.addError(
                    `Invalid parameter name: '${param.name}'`,
                    param.type.range,
                    DiagnosticSeverity.Error,
                    'invalid_parameter_name'
                );
            }
        }

        // Store function symbol
        this.symbolTable.set(symbolKey, {
            type: 'function',
            name: func.name,
            uri,
            range: func.range,
            parameters: func.parameters,
            returnType: func.returnType,
            isAsync: func.isAsync
        });

        // Create function scope for parameter analysis
        this.functionScopes.set(symbolKey, paramNames);
    }

    private collectStructDeclaration(struct: StructDeclaration, uri: string): void {
        const symbolKey = `${uri}:${struct.name}`;

        // Check for duplicate struct declarations
        if (this.symbolTable.has(symbolKey)) {
            this.addError(
                `Struct '${struct.name}' is already declared`,
                struct.range,
                DiagnosticSeverity.Error,
                'duplicate_struct'
            );
            return;
        }

        // Validate struct name (should be PascalCase)
        if (!this.isValidTypeName(struct.name)) {
            this.addError(
                `Invalid struct name: '${struct.name}' (should be PascalCase)`,
                struct.range,
                DiagnosticSeverity.Error,
                'invalid_struct_name'
            );
        }

        // Collect field names
        const fieldNames = new Set<string>();
        for (const field of struct.fields) {
            if (fieldNames.has(field.name)) {
                this.addError(
                    `Duplicate field name: '${field.name}'`,
                    field.type.range,
                    DiagnosticSeverity.Error,
                    'duplicate_field'
                );
            } else {
                fieldNames.add(field.name);
            }

            // Validate field name
            if (!this.isValidIdentifier(field.name)) {
                this.addError(
                    `Invalid field name: '${field.name}'`,
                    field.type.range,
                    DiagnosticSeverity.Error,
                    'invalid_field_name'
                );
            }
        }

        // Store struct symbol
        this.symbolTable.set(symbolKey, {
            type: 'struct',
            name: struct.name,
            uri,
            range: struct.range,
            fields: struct.fields,
            generics: struct.generics
        });
    }

    private collectEnumDeclaration(enumDecl: EnumDeclaration, uri: string): void {
        const symbolKey = `${uri}:${enumDecl.name}`;

        // Check for duplicate enum declarations
        if (this.symbolTable.has(symbolKey)) {
            this.addError(
                `Enum '${enumDecl.name}' is already declared`,
                enumDecl.range,
                DiagnosticSeverity.Error,
                'duplicate_enum'
            );
            return;
        }

        // Validate enum name (should be PascalCase)
        if (!this.isValidTypeName(enumDecl.name)) {
            this.addError(
                `Invalid enum name: '${enumDecl.name}' (should be PascalCase)`,
                enumDecl.range,
                DiagnosticSeverity.Error,
                'invalid_enum_name'
            );
        }

        // Collect variant names
        const variantNames = new Set<string>();
        for (const variant of enumDecl.variants) {
            if (variantNames.has(variant.name)) {
                this.addError(
                    `Duplicate variant name: '${variant.name}'`,
                    enumDecl.range,
                    DiagnosticSeverity.Error,
                    'duplicate_variant'
                );
            } else {
                variantNames.add(variant.name);
            }

            // Validate variant name (should be PascalCase)
            if (!this.isValidTypeName(variant.name)) {
                this.addError(
                    `Invalid variant name: '${variant.name}' (should be PascalCase)`,
                    enumDecl.range,
                    DiagnosticSeverity.Error,
                    'invalid_variant_name'
                );
            }
        }

        // Store enum symbol
        this.symbolTable.set(symbolKey, {
            type: 'enum',
            name: enumDecl.name,
            uri,
            range: enumDecl.range,
            variants: enumDecl.variants,
            generics: enumDecl.generics
        });
    }

    private collectVariableDeclaration(variable: VariableDeclaration, uri: string): void {
        const symbolKey = `${uri}:${variable.name}`;

        // Check for duplicate variable declarations in current scope
        if (this.symbolTable.has(symbolKey)) {
            this.addError(
                `Variable '${variable.name}' is already declared`,
                variable.range,
                DiagnosticSeverity.Error,
                'duplicate_variable'
            );
            return;
        }

        // Validate variable name
        if (!this.isValidIdentifier(variable.name)) {
            this.addError(
                `Invalid variable name: '${variable.name}'`,
                variable.range,
                DiagnosticSeverity.Error,
                'invalid_variable_name'
            );
        }

        // Validate const naming convention (should be UPPER_SNAKE_CASE)
        if (variable.isConst && !this.isValidConstName(variable.name)) {
            this.addError(
                `Constant '${variable.name}' should be in UPPER_SNAKE_CASE`,
                variable.range,
                DiagnosticSeverity.Warning,
                'const_naming_convention'
            );
        }

        // Store variable symbol
        this.symbolTable.set(symbolKey, {
            type: 'variable',
            name: variable.name,
            uri,
            range: variable.range,
            varType: variable.varType,
            isConst: variable.isConst
        });
    }

    private collectStatementDeclarations(stmt: Statement, uri: string): void {
        switch (stmt.kind) {
            case 'function':
                if (stmt.parameters) {
                    this.collectFunctionDeclaration({
                        type: 'function',
                        name: stmt.name || '',
                        parameters: stmt.parameters,
                        returnType: stmt.returnType,
                        body: [],
                        isAsync: false,
                        range: stmt.range,
                        line: stmt.line,
                        column: stmt.column
                    }, uri);
                }
                break;
            case 'struct':
                if (stmt.fields) {
                    this.collectStructDeclaration({
                        type: 'struct',
                        name: stmt.name || '',
                        fields: stmt.fields,
                        range: stmt.range,
                        line: stmt.line,
                        column: stmt.column
                    }, uri);
                }
                break;
            case 'enum':
                if (stmt.variants) {
                    this.collectEnumDeclaration({
                        type: 'enum',
                        name: stmt.name || '',
                        variants: stmt.variants,
                        range: stmt.range,
                        line: stmt.line,
                        column: stmt.column
                    }, uri);
                }
                break;
        }
    }

    private analyzeNode(node: ASTNode, uri: string): void {
        switch (node.type) {
            case 'function':
                this.analyzeFunction(node as FunctionDeclaration, uri);
                break;
            case 'struct':
                this.analyzeStruct(node as StructDeclaration, uri);
                break;
            case 'enum':
                this.analyzeEnum(node as EnumDeclaration, uri);
                break;
            case 'variable':
                this.analyzeVariable(node as VariableDeclaration, uri);
                break;
            case 'statement':
                this.analyzeStatement(node as Statement, uri);
                break;
        }
    }

    private analyzeFunction(func: FunctionDeclaration, uri: string): void {
        // Analyze function body
        for (const stmt of func.body) {
            this.analyzeStatement(stmt, uri);
        }

        // Check return type consistency
        if (func.returnType) {
            this.validateTypeExpression(func.returnType, uri);
        }

        // Check parameter types
        for (const param of func.parameters) {
            this.validateTypeExpression(param.type, uri);
        }
    }

    private analyzeStruct(struct: StructDeclaration, uri: string): void {
        // Check field types
        for (const field of struct.fields) {
            this.validateTypeExpression(field.type, uri);
        }

        // Check generic constraints
        if (struct.generics) {
            for (const generic of struct.generics) {
                if (generic.constraint) {
                    this.validateTypeExpression(generic.constraint, uri);
                }
            }
        }
    }

    private analyzeEnum(enumDecl: EnumDeclaration, uri: string): void {
        // Check variant field types
        for (const variant of enumDecl.variants) {
            if (variant.fields) {
                for (const field of variant.fields) {
                    this.validateTypeExpression(field.type, uri);
                }
            }
        }

        // Check generic constraints
        if (enumDecl.generics) {
            for (const generic of enumDecl.generics) {
                if (generic.constraint) {
                    this.validateTypeExpression(generic.constraint, uri);
                }
            }
        }
    }

    private analyzeVariable(variable: VariableDeclaration, uri: string): void {
        // Check type annotation
        if (variable.varType) {
            this.validateTypeExpression(variable.varType, uri);
        }

        // Check initial value
        if (variable.value) {
            this.analyzeExpression(variable.value, uri);
        }
    }

    private analyzeStatement(stmt: Statement, uri: string): void {
        switch (stmt.kind) {
            case 'expression':
                if (stmt.expression) {
                    this.analyzeExpression(stmt.expression, uri);
                }
                break;
            case 'if':
                if (stmt.condition) {
                    this.analyzeExpression(stmt.condition, uri);
                }
                if (stmt.thenBody) {
                    for (const bodyStmt of stmt.thenBody) {
                        this.analyzeStatement(bodyStmt, uri);
                    }
                }
                if (stmt.elseBody) {
                    for (const bodyStmt of stmt.elseBody) {
                        this.analyzeStatement(bodyStmt, uri);
                    }
                }
                break;
            case 'for':
                if (stmt.collection) {
                    this.analyzeExpression(stmt.collection, uri);
                }
                if (stmt.body) {
                    for (const bodyStmt of stmt.body) {
                        this.analyzeStatement(bodyStmt, uri);
                    }
                }
                break;
            case 'while':
                if (stmt.condition) {
                    this.analyzeExpression(stmt.condition, uri);
                }
                if (stmt.body) {
                    for (const bodyStmt of stmt.body) {
                        this.analyzeStatement(bodyStmt, uri);
                    }
                }
                break;
            case 'match':
                if (stmt.expression) {
                    this.analyzeExpression(stmt.expression, uri);
                }
                if (stmt.cases) {
                    for (const matchCase of stmt.cases) {
                        this.analyzeExpression(matchCase.pattern, uri);
                        if (matchCase.guard) {
                            this.analyzeExpression(matchCase.guard, uri);
                        }
                        for (const bodyStmt of matchCase.body) {
                            this.analyzeStatement(bodyStmt, uri);
                        }
                    }
                }
                break;
            case 'return':
                if (stmt.value) {
                    this.analyzeExpression(stmt.value, uri);
                }
                break;
            case 'function':
            case 'struct':
            case 'enum':
            case 'variable':
                // These are handled in collectDeclarations
                break;
        }
    }

    private analyzeExpression(expr: Expression, uri: string): void {
        switch (expr.kind) {
            case 'literal':
                // Literals are always valid
                break;
            case 'identifier':
                this.validateIdentifier(expr.value as string, expr.range, uri);
                break;
            case 'binary':
                if (expr.left) this.analyzeExpression(expr.left, uri);
                if (expr.right) this.analyzeExpression(expr.right, uri);
                break;
            case 'unary':
                if (expr.right) this.analyzeExpression(expr.right, uri);
                break;
            case 'call':
                if (expr.left) this.analyzeExpression(expr.left, uri);
                if (expr.value) {
                    const args = expr.value as Expression[];
                    for (const arg of args) {
                        this.analyzeExpression(arg, uri);
                    }
                }
                break;
            case 'member_access':
                if (expr.left) this.analyzeExpression(expr.left, uri);
                break;
            case 'index_access':
                if (expr.left) this.analyzeExpression(expr.left, uri);
                if (expr.right) this.analyzeExpression(expr.right, uri);
                break;
            case 'parenthesized':
                if (expr.value) this.analyzeExpression(expr.value as Expression, uri);
                break;
            case 'array':
                if (expr.value) {
                    const elements = expr.value as Expression[];
                    for (const element of elements) {
                        this.analyzeExpression(element, uri);
                    }
                }
                break;
            case 'block':
                if (expr.value) {
                    const statements = expr.value as Statement[];
                    for (const stmt of statements) {
                        this.analyzeStatement(stmt, uri);
                    }
                }
                break;
        }
    }

    private validateTypeExpression(typeExpr: TypeExpression, uri: string): void {
        // Check if base type is valid
        if (!this.isValidTypeName(typeExpr.baseType) && !this.isPrimitiveType(typeExpr.baseType)) {
            this.addError(
                `Unknown type: '${typeExpr.baseType}'`,
                { start: typeExpr.range.start, end: typeExpr.range.end },
                DiagnosticSeverity.Error,
                'unknown_type'
            );
        }

        // Check generic arguments
        if (typeExpr.genericArgs) {
            for (const genericArg of typeExpr.genericArgs) {
                this.validateTypeExpression(genericArg, uri);
            }
        }
    }

    private validateIdentifier(name: string, range: { start: number; end: number }, uri: string): void {
        const symbolKey = `${uri}:${name}`;

        // Check if identifier is declared
        if (!this.symbolTable.has(symbolKey)) {
            this.addError(
                `Undefined identifier: '${name}'`,
                range,
                DiagnosticSeverity.Error,
                'undefined_identifier'
            );
        }
    }

    private isValidIdentifier(name: string): boolean {
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
    }

    private isValidTypeName(name: string): boolean {
        return /^[A-Z][a-zA-Z0-9_]*$/.test(name);
    }

    private isValidConstName(name: string): boolean {
        return /^[A-Z][A-Z0-9_]*$/.test(name);
    }

    private isPrimitiveType(name: string): boolean {
        const primitiveTypes = ['int', 'float', 'bool', 'string', 'char', 'void'];
        return primitiveTypes.includes(name);
    }

    private addError(message: string, range: { start: number; end: number }, severity: DiagnosticSeverity, code?: string): void {
        this.errors.push({
            message,
            range: {
                start: { line: 0, character: range.start },
                end: { line: 0, character: range.end }
            },
            severity,
            code
        });
    }

    private createRange(start: number, end: number): Range {
        // This is a simplified range creation - in a real implementation,
        // you'd need to convert character offsets to line/column positions
        return {
            start: { line: 0, character: start },
            end: { line: 0, character: end }
        };
    }
}

interface SymbolInfo {
    type: 'function' | 'struct' | 'enum' | 'variable';
    name: string;
    uri: string;
    range: { start: number; end: number };
    parameters?: Parameter[];
    returnType?: TypeExpression;
    isAsync?: boolean;
    fields?: Field[];
    generics?: any[];
    variants?: EnumVariant[];
    varType?: TypeExpression;
    isConst?: boolean;
} 