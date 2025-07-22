import { Expression, TypeExpression, Statement, FunctionDeclaration, StructDeclaration, EnumDeclaration, VariableDeclaration, Parameter, Field, EnumVariant } from '../parser/parser';

export interface Type {
    kind: TypeKind;
    name: string;
    genericArgs?: Type[];
    isReference?: boolean;
    isMutable?: boolean;
}

export enum TypeKind {
    PRIMITIVE = 'primitive',
    STRUCT = 'struct',
    ENUM = 'enum',
    FUNCTION = 'function',
    GENERIC = 'generic',
    UNKNOWN = 'unknown',
    ERROR = 'error'
}

export interface TypeContext {
    variables: Map<string, Type>;
    functions: Map<string, FunctionType>;
    types: Map<string, Type>;
    returnType?: Type;
    inLoop: boolean;
    inFunction: boolean;
}

export interface FunctionType {
    parameters: Type[];
    returnType: Type;
    isAsync: boolean;
}

export interface TypeError {
    message: string;
    range: { start: number; end: number };
    line: number;
    column: number;
}

export class TypeChecker {
    private errors: TypeError[] = [];
    private globalContext: TypeContext;

    constructor() {
        this.globalContext = this.createGlobalContext();
    }

    checkTypes(ast: any[], uri: string): TypeError[] {
        this.errors = [];

        // First pass: collect all type declarations
        for (const node of ast) {
            this.collectTypes(node, uri);
        }

        // Second pass: type check all expressions and statements
        for (const node of ast) {
            this.checkNode(node, this.globalContext, uri);
        }

        return this.errors;
    }

    private createGlobalContext(): TypeContext {
        return {
            variables: new Map(),
            functions: new Map(),
            types: new Map(),
            inLoop: false,
            inFunction: false
        };
    }

    private collectTypes(node: any, uri: string): void {
        switch (node.type) {
            case 'function':
                this.collectFunctionType(node as FunctionDeclaration, uri);
                break;
            case 'struct':
                this.collectStructType(node as StructDeclaration, uri);
                break;
            case 'enum':
                this.collectEnumType(node as EnumDeclaration, uri);
                break;
            case 'statement':
                this.collectStatementTypes(node as Statement, uri);
                break;
        }
    }

    private collectFunctionType(func: FunctionDeclaration, uri: string): void {
        const paramTypes: Type[] = [];

        for (const param of func.parameters) {
            const paramType = this.parseTypeExpression(param.type);
            paramTypes.push(paramType);
        }

        const returnType = func.returnType ? this.parseTypeExpression(func.returnType) : this.createPrimitiveType('void');

        const functionType: FunctionType = {
            parameters: paramTypes,
            returnType,
            isAsync: func.isAsync
        };

        this.globalContext.functions.set(func.name, functionType);
    }

    private collectStructType(struct: StructDeclaration, uri: string): void {
        const structType: Type = {
            kind: TypeKind.STRUCT,
            name: struct.name,
            genericArgs: struct.generics?.map(g => this.createGenericType(g.name, []))
        };

        this.globalContext.types.set(struct.name, structType);
    }

    private collectEnumType(enumDecl: EnumDeclaration, uri: string): void {
        const enumType: Type = {
            kind: TypeKind.ENUM,
            name: enumDecl.name,
            genericArgs: enumDecl.generics?.map(g => this.createGenericType(g.name, []))
        };

        this.globalContext.types.set(enumDecl.name, enumType);
    }

    private collectStatementTypes(stmt: Statement, uri: string): void {
        switch (stmt.kind) {
            case 'function':
                if (stmt.parameters && stmt.name) {
                    const paramTypes: Type[] = [];
                    for (const param of stmt.parameters) {
                        paramTypes.push(this.parseTypeExpression(param.type));
                    }
                    const returnType = stmt.returnType ? this.parseTypeExpression(stmt.returnType) : this.createPrimitiveType('void');
                    this.globalContext.functions.set(stmt.name, {
                        parameters: paramTypes,
                        returnType,
                        isAsync: false
                    });
                }
                break;
            case 'struct':
                if (stmt.name) {
                    this.globalContext.types.set(stmt.name, {
                        kind: TypeKind.STRUCT,
                        name: stmt.name
                    });
                }
                break;
            case 'enum':
                if (stmt.name) {
                    this.globalContext.types.set(stmt.name, {
                        kind: TypeKind.ENUM,
                        name: stmt.name
                    });
                }
                break;
        }
    }

    private checkNode(node: any, context: TypeContext, uri: string): void {
        switch (node.type) {
            case 'function':
                this.checkFunction(node as FunctionDeclaration, context, uri);
                break;
            case 'struct':
                this.checkStruct(node as StructDeclaration, context, uri);
                break;
            case 'enum':
                this.checkEnum(node as EnumDeclaration, context, uri);
                break;
            case 'variable':
                this.checkVariable(node as VariableDeclaration, context, uri);
                break;
            case 'statement':
                this.checkStatement(node as Statement, context, uri);
                break;
        }
    }

    private checkFunction(func: FunctionDeclaration, context: TypeContext, uri: string): void {
        const functionContext: TypeContext = {
            variables: new Map(context.variables),
            functions: new Map(context.functions),
            types: new Map(context.types),
            returnType: func.returnType ? this.parseTypeExpression(func.returnType) : this.createPrimitiveType('void'),
            inLoop: false,
            inFunction: true
        };

        // Add parameters to function context
        for (const param of func.parameters) {
            const paramType = this.parseTypeExpression(param.type);
            functionContext.variables.set(param.name, paramType);
        }

        // Check function body
        for (const stmt of func.body) {
            this.checkStatement(stmt, functionContext, uri);
        }
    }

    private checkStruct(struct: StructDeclaration, context: TypeContext, uri: string): void {
        // Check field types
        for (const field of struct.fields) {
            const fieldType = this.parseTypeExpression(field.type);
            if (fieldType.kind === TypeKind.ERROR) {
                this.addError(
                    `Invalid field type: ${field.type.baseType}`,
                    field.type.range,
                    field.type.line,
                    field.type.column
                );
            }
        }
    }

    private checkEnum(enumDecl: EnumDeclaration, context: TypeContext, uri: string): void {
        // Check variant field types
        for (const variant of enumDecl.variants) {
            if (variant.fields) {
                for (const field of variant.fields) {
                    const fieldType = this.parseTypeExpression(field.type);
                    if (fieldType.kind === TypeKind.ERROR) {
                        this.addError(
                            `Invalid variant field type: ${field.type.baseType}`,
                            field.type.range,
                            field.type.line,
                            field.type.column
                        );
                    }
                }
            }
        }
    }

    private checkVariable(variable: VariableDeclaration, context: TypeContext, uri: string): void {
        let expectedType: Type;

        if (variable.varType) {
            expectedType = this.parseTypeExpression(variable.varType);
        } else if (variable.value) {
            expectedType = this.inferExpressionType(variable.value, context, uri);
        } else {
            expectedType = this.createUnknownType();
        }

        if (variable.value) {
            const actualType = this.inferExpressionType(variable.value, context, uri);
            this.checkTypeCompatibility(actualType, expectedType, variable.value.range, variable.value.line, variable.value.column);
        }

        context.variables.set(variable.name, expectedType);
    }

    private checkStatement(stmt: Statement, context: TypeContext, uri: string): void {
        switch (stmt.kind) {
            case 'expression':
                if (stmt.expression) {
                    this.inferExpressionType(stmt.expression, context, uri);
                }
                break;
            case 'if':
                if (stmt.condition) {
                    const conditionType = this.inferExpressionType(stmt.condition, context, uri);
                    this.checkBooleanType(conditionType, stmt.condition.range, stmt.condition.line, stmt.condition.column);
                }
                if (stmt.thenBody) {
                    for (const bodyStmt of stmt.thenBody) {
                        this.checkStatement(bodyStmt, context, uri);
                    }
                }
                if (stmt.elseBody) {
                    for (const bodyStmt of stmt.elseBody) {
                        this.checkStatement(bodyStmt, context, uri);
                    }
                }
                break;
            case 'for':
                if (stmt.collection) {
                    const collectionType = this.inferExpressionType(stmt.collection, context, uri);
                    this.checkIterableType(collectionType, stmt.collection.range, stmt.collection.line, stmt.collection.column);
                }
                if (stmt.body) {
                    const loopContext = { ...context, inLoop: true };
                    for (const bodyStmt of stmt.body) {
                        this.checkStatement(bodyStmt, loopContext, uri);
                    }
                }
                break;
            case 'while':
                if (stmt.condition) {
                    const conditionType = this.inferExpressionType(stmt.condition, context, uri);
                    this.checkBooleanType(conditionType, stmt.condition.range, stmt.condition.line, stmt.condition.column);
                }
                if (stmt.body) {
                    const loopContext = { ...context, inLoop: true };
                    for (const bodyStmt of stmt.body) {
                        this.checkStatement(bodyStmt, loopContext, uri);
                    }
                }
                break;
            case 'match':
                if (stmt.expression) {
                    const matchType = this.inferExpressionType(stmt.expression, context, uri);
                    if (stmt.cases) {
                        for (const matchCase of stmt.cases) {
                            const patternType = this.inferExpressionType(matchCase.pattern, context, uri);
                            this.checkTypeCompatibility(patternType, matchType, matchCase.pattern.range, matchCase.pattern.line, matchCase.pattern.column);

                            if (matchCase.guard) {
                                const guardType = this.inferExpressionType(matchCase.guard, context, uri);
                                this.checkBooleanType(guardType, matchCase.guard.range, matchCase.guard.line, matchCase.guard.column);
                            }

                            for (const bodyStmt of matchCase.body) {
                                this.checkStatement(bodyStmt, context, uri);
                            }
                        }
                    }
                }
                break;
            case 'return':
                if (stmt.value) {
                    const returnType = this.inferExpressionType(stmt.value, context, uri);
                    if (context.returnType) {
                        this.checkTypeCompatibility(returnType, context.returnType, stmt.value.range, stmt.value.line, stmt.value.column);
                    }
                } else if (context.returnType && context.returnType.name !== 'void') {
                    this.addError(
                        'Missing return value',
                        stmt.range,
                        stmt.line,
                        stmt.column
                    );
                }
                break;
            case 'break':
            case 'continue':
                if (!context.inLoop) {
                    this.addError(
                        `${stmt.kind} statement outside of loop`,
                        stmt.range,
                        stmt.line,
                        stmt.column
                    );
                }
                break;
        }
    }

    private inferExpressionType(expr: Expression, context: TypeContext, uri: string): Type {
        switch (expr.kind) {
            case 'literal':
                return this.inferLiteralType(expr.value);
            case 'identifier':
                return this.lookupVariableType(expr.value as string, context, expr.range, expr.line, expr.column);
            case 'binary':
                return this.inferBinaryExpressionType(expr, context, uri);
            case 'unary':
                return this.inferUnaryExpressionType(expr, context, uri);
            case 'call':
                return this.inferCallExpressionType(expr, context, uri);
            case 'member_access':
                return this.inferMemberAccessType(expr, context, uri);
            case 'index_access':
                return this.inferIndexAccessType(expr, context, uri);
            case 'parenthesized':
                return this.inferExpressionType(expr.value as Expression, context, uri);
            case 'array':
                return this.inferArrayType(expr, context, uri);
            case 'block':
                return this.inferBlockType(expr, context, uri);
            default:
                return this.createUnknownType();
        }
    }

    private inferLiteralType(value: any): Type {
        if (typeof value === 'string') {
            if (value.startsWith('"') || value.startsWith("'")) {
                return this.createPrimitiveType('string');
            } else if (value === 'true' || value === 'false') {
                return this.createPrimitiveType('bool');
            }
        } else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                return this.createPrimitiveType('int');
            } else {
                return this.createPrimitiveType('float');
            }
        }
        return this.createUnknownType();
    }

    private inferBinaryExpressionType(expr: Expression, context: TypeContext, uri: string): Type {
        if (!expr.left || !expr.right) return this.createUnknownType();

        const leftType = this.inferExpressionType(expr.left, context, uri);
        const rightType = this.inferExpressionType(expr.right, context, uri);

        switch (expr.operator) {
            case '+':
            case '-':
            case '*':
            case '/':
            case '%':
                return this.inferArithmeticType(leftType, rightType, expr.range, expr.line, expr.column);
            case '==':
            case '!=':
            case '<':
            case '<=':
            case '>':
            case '>=':
                return this.createPrimitiveType('bool');
            case '&&':
            case '||':
                this.checkBooleanType(leftType, expr.left.range, expr.left.line, expr.left.column);
                this.checkBooleanType(rightType, expr.right.range, expr.right.line, expr.right.column);
                return this.createPrimitiveType('bool');
            case '=':
            case '+=':
            case '-=':
            case '*=':
            case '/=':
            case '%=':
                this.checkTypeCompatibility(rightType, leftType, expr.range, expr.line, expr.column);
                return leftType;
            default:
                return this.createUnknownType();
        }
    }

    private inferUnaryExpressionType(expr: Expression, context: TypeContext, uri: string): Type {
        if (!expr.right) return this.createUnknownType();

        const operandType = this.inferExpressionType(expr.right, context, uri);

        switch (expr.operator) {
            case '-':
                if (operandType.name === 'int' || operandType.name === 'float') {
                    return operandType;
                }
                this.addError(
                    `Cannot apply unary '-' to type '${operandType.name}'`,
                    expr.range,
                    expr.line,
                    expr.column
                );
                return this.createErrorType();
            case '!':
                this.checkBooleanType(operandType, expr.right.range, expr.right.line, expr.right.column);
                return this.createPrimitiveType('bool');
            default:
                return this.createUnknownType();
        }
    }

    private inferCallExpressionType(expr: Expression, context: TypeContext, uri: string): Type {
        if (!expr.left) return this.createUnknownType();

        const calleeType = this.inferExpressionType(expr.left, context, uri);
        const args = expr.value as Expression[] || [];

        if (calleeType.kind === TypeKind.FUNCTION) {
            const functionType = calleeType as any;
            this.checkFunctionCall(functionType, args, context, uri, expr.range, expr.line, expr.column);
            return functionType.returnType;
        } else {
            this.addError(
                `Cannot call expression of type '${calleeType.name}'`,
                expr.range,
                expr.line,
                expr.column
            );
            return this.createErrorType();
        }
    }

    private inferMemberAccessType(expr: Expression, context: TypeContext, uri: string): Type {
        if (!expr.left) return this.createUnknownType();

        const objectType = this.inferExpressionType(expr.left, context, uri);
        const memberName = expr.value as string;

        if (objectType.kind === TypeKind.STRUCT) {
            // Look up struct field
            return this.lookupStructField(objectType, memberName, expr.range, expr.line, expr.column);
        } else if (objectType.kind === TypeKind.ENUM) {
            // Look up enum variant
            return this.lookupEnumVariant(objectType, memberName, expr.range, expr.line, expr.column);
        } else {
            this.addError(
                `Cannot access member '${memberName}' on type '${objectType.name}'`,
                expr.range,
                expr.line,
                expr.column
            );
            return this.createErrorType();
        }
    }

    private inferIndexAccessType(expr: Expression, context: TypeContext, uri: string): Type {
        if (!expr.left || !expr.right) return this.createUnknownType();

        const arrayType = this.inferExpressionType(expr.left, context, uri);
        const indexType = this.inferExpressionType(expr.right, context, uri);

        // Check that index is integer
        if (indexType.name !== 'int') {
            this.addError(
                `Array index must be of type 'int', got '${indexType.name}'`,
                expr.right.range,
                expr.right.line,
                expr.right.column
            );
        }

        // Check that left operand is array-like
        if (arrayType.name === 'Vec' || arrayType.name === 'string') {
            return this.getArrayElementType(arrayType);
        } else {
            this.addError(
                `Cannot index type '${arrayType.name}'`,
                expr.left.range,
                expr.left.line,
                expr.left.column
            );
            return this.createErrorType();
        }
    }

    private inferArrayType(expr: Expression, context: TypeContext, uri: string): Type {
        const elements = expr.value as Expression[] || [];

        if (elements.length === 0) {
            return this.createGenericType('Vec', [this.createUnknownType()]);
        }

        const elementTypes = elements.map(element => this.inferExpressionType(element, context, uri));
        const firstType = elementTypes[0];

        // Check that all elements have the same type
        for (let i = 1; i < elementTypes.length; i++) {
            if (!this.typesEqual(elementTypes[i], firstType)) {
                this.addError(
                    `Array elements must have the same type, got '${firstType.name}' and '${elementTypes[i].name}'`,
                    elements[i].range,
                    elements[i].line,
                    elements[i].column
                );
            }
        }

        return this.createGenericType('Vec', [firstType]);
    }

    private inferBlockType(expr: Expression, context: TypeContext, uri: string): Type {
        const statements = expr.value as Statement[] || [];

        if (statements.length === 0) {
            return this.createPrimitiveType('void');
        }

        // Return type of last expression statement
        for (let i = statements.length - 1; i >= 0; i--) {
            const stmt = statements[i];
            if (stmt.kind === 'expression' && stmt.expression) {
                return this.inferExpressionType(stmt.expression, context, uri);
            }
        }

        return this.createPrimitiveType('void');
    }

    private parseTypeExpression(typeExpr: TypeExpression): Type {
        const baseType = this.lookupType(typeExpr.baseType);

        if (baseType.kind === TypeKind.ERROR) {
            return this.createErrorType();
        }

        if (typeExpr.genericArgs) {
            const genericArgs = typeExpr.genericArgs.map(arg => this.parseTypeExpression(arg));
            return this.createGenericType(baseType.name, genericArgs);
        }

        return baseType;
    }

    private lookupType(name: string): Type {
        const primitiveTypes = ['int', 'float', 'bool', 'string', 'char', 'void'];

        if (primitiveTypes.includes(name)) {
            return this.createPrimitiveType(name);
        }

        const type = this.globalContext.types.get(name);
        if (type) {
            return type;
        }

        return this.createErrorType();
    }

    private lookupVariableType(name: string, context: TypeContext, range: any, line: number, column: number): Type {
        const type = context.variables.get(name);
        if (type) {
            return type;
        }

        this.addError(
            `Undefined variable: '${name}'`,
            range,
            line,
            column
        );
        return this.createErrorType();
    }

    private checkTypeCompatibility(actual: Type, expected: Type, range: any, line: number, column: number): void {
        if (!this.typesEqual(actual, expected)) {
            this.addError(
                `Type mismatch: expected '${expected.name}', got '${actual.name}'`,
                range,
                line,
                column
            );
        }
    }

    private checkBooleanType(type: Type, range: any, line: number, column: number): void {
        if (type.name !== 'bool') {
            this.addError(
                `Expected boolean type, got '${type.name}'`,
                range,
                line,
                column
            );
        }
    }

    private checkIterableType(type: Type, range: any, line: number, column: number): void {
        if (type.name !== 'Vec' && type.name !== 'string') {
            this.addError(
                `Expected iterable type (Vec or string), got '${type.name}'`,
                range,
                line,
                column
            );
        }
    }

    private checkFunctionCall(functionType: any, args: Expression[], context: TypeContext, uri: string, range: any, line: number, column: number): void {
        if (args.length !== functionType.parameters.length) {
            this.addError(
                `Function expects ${functionType.parameters.length} arguments, got ${args.length}`,
                range,
                line,
                column
            );
            return;
        }

        for (let i = 0; i < args.length; i++) {
            const argType = this.inferExpressionType(args[i], context, uri);
            const paramType = functionType.parameters[i];
            this.checkTypeCompatibility(argType, paramType, args[i].range, args[i].line, args[i].column);
        }
    }

    private inferArithmeticType(left: Type, right: Type, range: any, line: number, column: number): Type {
        if (left.name === 'float' || right.name === 'float') {
            return this.createPrimitiveType('float');
        } else if (left.name === 'int' && right.name === 'int') {
            return this.createPrimitiveType('int');
        } else {
            this.addError(
                `Cannot perform arithmetic on types '${left.name}' and '${right.name}'`,
                range,
                line,
                column
            );
            return this.createErrorType();
        }
    }

    private lookupStructField(structType: Type, fieldName: string, range: any, line: number, column: number): Type {
        // In a real implementation, you'd look up the actual struct definition
        // For now, return unknown type
        return this.createUnknownType();
    }

    private lookupEnumVariant(enumType: Type, variantName: string, range: any, line: number, column: number): Type {
        // In a real implementation, you'd look up the actual enum definition
        // For now, return unknown type
        return this.createUnknownType();
    }

    private getArrayElementType(arrayType: Type): Type {
        if (arrayType.name === 'Vec' && arrayType.genericArgs && arrayType.genericArgs.length > 0) {
            return arrayType.genericArgs[0];
        } else if (arrayType.name === 'string') {
            return this.createPrimitiveType('char');
        }
        return this.createUnknownType();
    }

    private typesEqual(a: Type, b: Type): boolean {
        if (a.kind !== b.kind) return false;
        if (a.name !== b.name) return false;
        if (a.isReference !== b.isReference) return false;
        if (a.isMutable !== b.isMutable) return false;

        if (a.genericArgs && b.genericArgs) {
            if (a.genericArgs.length !== b.genericArgs.length) return false;
            for (let i = 0; i < a.genericArgs.length; i++) {
                if (!this.typesEqual(a.genericArgs[i], b.genericArgs[i])) return false;
            }
        } else if (a.genericArgs || b.genericArgs) {
            return false;
        }

        return true;
    }

    private createPrimitiveType(name: string): Type {
        return { kind: TypeKind.PRIMITIVE, name };
    }

    private createStructType(name: string, genericArgs?: Type[]): Type {
        return { kind: TypeKind.STRUCT, name, genericArgs };
    }

    private createEnumType(name: string, genericArgs?: Type[]): Type {
        return { kind: TypeKind.ENUM, name, genericArgs };
    }

    private createFunctionType(parameters: Type[], returnType: Type, isAsync: boolean = false): Type {
        return { kind: TypeKind.FUNCTION, name: 'function', genericArgs: parameters, isAsync } as any;
    }

    private createGenericType(name: string, genericArgs: Type[]): Type {
        return { kind: TypeKind.GENERIC, name, genericArgs };
    }

    private createUnknownType(): Type {
        return { kind: TypeKind.UNKNOWN, name: 'unknown' };
    }

    private createErrorType(): Type {
        return { kind: TypeKind.ERROR, name: 'error' };
    }

    private addError(message: string, range: any, line: number, column: number): void {
        this.errors.push({
            message,
            range,
            line,
            column
        });
    }
} 