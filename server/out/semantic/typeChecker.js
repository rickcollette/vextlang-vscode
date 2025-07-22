"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeChecker = exports.TypeKind = void 0;
var TypeKind;
(function (TypeKind) {
    TypeKind["PRIMITIVE"] = "primitive";
    TypeKind["STRUCT"] = "struct";
    TypeKind["ENUM"] = "enum";
    TypeKind["FUNCTION"] = "function";
    TypeKind["GENERIC"] = "generic";
    TypeKind["UNKNOWN"] = "unknown";
    TypeKind["ERROR"] = "error";
})(TypeKind || (exports.TypeKind = TypeKind = {}));
class TypeChecker {
    constructor() {
        this.errors = [];
        this.globalContext = this.createGlobalContext();
    }
    checkTypes(ast, uri) {
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
    createGlobalContext() {
        return {
            variables: new Map(),
            functions: new Map(),
            types: new Map(),
            inLoop: false,
            inFunction: false
        };
    }
    collectTypes(node, uri) {
        switch (node.type) {
            case 'function':
                this.collectFunctionType(node, uri);
                break;
            case 'struct':
                this.collectStructType(node, uri);
                break;
            case 'enum':
                this.collectEnumType(node, uri);
                break;
            case 'statement':
                this.collectStatementTypes(node, uri);
                break;
        }
    }
    collectFunctionType(func, uri) {
        const paramTypes = [];
        for (const param of func.parameters) {
            const paramType = this.parseTypeExpression(param.type);
            paramTypes.push(paramType);
        }
        const returnType = func.returnType ? this.parseTypeExpression(func.returnType) : this.createPrimitiveType('void');
        const functionType = {
            parameters: paramTypes,
            returnType,
            isAsync: func.isAsync
        };
        this.globalContext.functions.set(func.name, functionType);
    }
    collectStructType(struct, uri) {
        const structType = {
            kind: TypeKind.STRUCT,
            name: struct.name,
            genericArgs: struct.generics?.map(g => this.createGenericType(g.name, []))
        };
        this.globalContext.types.set(struct.name, structType);
    }
    collectEnumType(enumDecl, uri) {
        const enumType = {
            kind: TypeKind.ENUM,
            name: enumDecl.name,
            genericArgs: enumDecl.generics?.map(g => this.createGenericType(g.name, []))
        };
        this.globalContext.types.set(enumDecl.name, enumType);
    }
    collectStatementTypes(stmt, uri) {
        switch (stmt.kind) {
            case 'function':
                if (stmt.parameters && stmt.name) {
                    const paramTypes = [];
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
    checkNode(node, context, uri) {
        switch (node.type) {
            case 'function':
                this.checkFunction(node, context, uri);
                break;
            case 'struct':
                this.checkStruct(node, context, uri);
                break;
            case 'enum':
                this.checkEnum(node, context, uri);
                break;
            case 'variable':
                this.checkVariable(node, context, uri);
                break;
            case 'statement':
                this.checkStatement(node, context, uri);
                break;
        }
    }
    checkFunction(func, context, uri) {
        const functionContext = {
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
    checkStruct(struct, context, uri) {
        // Check field types
        for (const field of struct.fields) {
            const fieldType = this.parseTypeExpression(field.type);
            if (fieldType.kind === TypeKind.ERROR) {
                this.addError(`Invalid field type: ${field.type.baseType}`, field.type.range, field.type.line, field.type.column);
            }
        }
    }
    checkEnum(enumDecl, context, uri) {
        // Check variant field types
        for (const variant of enumDecl.variants) {
            if (variant.fields) {
                for (const field of variant.fields) {
                    const fieldType = this.parseTypeExpression(field.type);
                    if (fieldType.kind === TypeKind.ERROR) {
                        this.addError(`Invalid variant field type: ${field.type.baseType}`, field.type.range, field.type.line, field.type.column);
                    }
                }
            }
        }
    }
    checkVariable(variable, context, uri) {
        let expectedType;
        if (variable.varType) {
            expectedType = this.parseTypeExpression(variable.varType);
        }
        else if (variable.value) {
            expectedType = this.inferExpressionType(variable.value, context, uri);
        }
        else {
            expectedType = this.createUnknownType();
        }
        if (variable.value) {
            const actualType = this.inferExpressionType(variable.value, context, uri);
            this.checkTypeCompatibility(actualType, expectedType, variable.value.range, variable.value.line, variable.value.column);
        }
        context.variables.set(variable.name, expectedType);
    }
    checkStatement(stmt, context, uri) {
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
                }
                else if (context.returnType && context.returnType.name !== 'void') {
                    this.addError('Missing return value', stmt.range, stmt.line, stmt.column);
                }
                break;
            case 'break':
            case 'continue':
                if (!context.inLoop) {
                    this.addError(`${stmt.kind} statement outside of loop`, stmt.range, stmt.line, stmt.column);
                }
                break;
        }
    }
    inferExpressionType(expr, context, uri) {
        switch (expr.kind) {
            case 'literal':
                return this.inferLiteralType(expr.value);
            case 'identifier':
                return this.lookupVariableType(expr.value, context, expr.range, expr.line, expr.column);
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
                return this.inferExpressionType(expr.value, context, uri);
            case 'array':
                return this.inferArrayType(expr, context, uri);
            case 'block':
                return this.inferBlockType(expr, context, uri);
            default:
                return this.createUnknownType();
        }
    }
    inferLiteralType(value) {
        if (typeof value === 'string') {
            if (value.startsWith('"') || value.startsWith("'")) {
                return this.createPrimitiveType('string');
            }
            else if (value === 'true' || value === 'false') {
                return this.createPrimitiveType('bool');
            }
        }
        else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                return this.createPrimitiveType('int');
            }
            else {
                return this.createPrimitiveType('float');
            }
        }
        return this.createUnknownType();
    }
    inferBinaryExpressionType(expr, context, uri) {
        if (!expr.left || !expr.right)
            return this.createUnknownType();
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
    inferUnaryExpressionType(expr, context, uri) {
        if (!expr.right)
            return this.createUnknownType();
        const operandType = this.inferExpressionType(expr.right, context, uri);
        switch (expr.operator) {
            case '-':
                if (operandType.name === 'int' || operandType.name === 'float') {
                    return operandType;
                }
                this.addError(`Cannot apply unary '-' to type '${operandType.name}'`, expr.range, expr.line, expr.column);
                return this.createErrorType();
            case '!':
                this.checkBooleanType(operandType, expr.right.range, expr.right.line, expr.right.column);
                return this.createPrimitiveType('bool');
            default:
                return this.createUnknownType();
        }
    }
    inferCallExpressionType(expr, context, uri) {
        if (!expr.left)
            return this.createUnknownType();
        const calleeType = this.inferExpressionType(expr.left, context, uri);
        const args = expr.value || [];
        if (calleeType.kind === TypeKind.FUNCTION) {
            const functionType = calleeType;
            this.checkFunctionCall(functionType, args, context, uri, expr.range, expr.line, expr.column);
            return functionType.returnType;
        }
        else {
            this.addError(`Cannot call expression of type '${calleeType.name}'`, expr.range, expr.line, expr.column);
            return this.createErrorType();
        }
    }
    inferMemberAccessType(expr, context, uri) {
        if (!expr.left)
            return this.createUnknownType();
        const objectType = this.inferExpressionType(expr.left, context, uri);
        const memberName = expr.value;
        if (objectType.kind === TypeKind.STRUCT) {
            // Look up struct field
            return this.lookupStructField(objectType, memberName, expr.range, expr.line, expr.column);
        }
        else if (objectType.kind === TypeKind.ENUM) {
            // Look up enum variant
            return this.lookupEnumVariant(objectType, memberName, expr.range, expr.line, expr.column);
        }
        else {
            this.addError(`Cannot access member '${memberName}' on type '${objectType.name}'`, expr.range, expr.line, expr.column);
            return this.createErrorType();
        }
    }
    inferIndexAccessType(expr, context, uri) {
        if (!expr.left || !expr.right)
            return this.createUnknownType();
        const arrayType = this.inferExpressionType(expr.left, context, uri);
        const indexType = this.inferExpressionType(expr.right, context, uri);
        // Check that index is integer
        if (indexType.name !== 'int') {
            this.addError(`Array index must be of type 'int', got '${indexType.name}'`, expr.right.range, expr.right.line, expr.right.column);
        }
        // Check that left operand is array-like
        if (arrayType.name === 'Vec' || arrayType.name === 'string') {
            return this.getArrayElementType(arrayType);
        }
        else {
            this.addError(`Cannot index type '${arrayType.name}'`, expr.left.range, expr.left.line, expr.left.column);
            return this.createErrorType();
        }
    }
    inferArrayType(expr, context, uri) {
        const elements = expr.value || [];
        if (elements.length === 0) {
            return this.createGenericType('Vec', [this.createUnknownType()]);
        }
        const elementTypes = elements.map(element => this.inferExpressionType(element, context, uri));
        const firstType = elementTypes[0];
        // Check that all elements have the same type
        for (let i = 1; i < elementTypes.length; i++) {
            if (!this.typesEqual(elementTypes[i], firstType)) {
                this.addError(`Array elements must have the same type, got '${firstType.name}' and '${elementTypes[i].name}'`, elements[i].range, elements[i].line, elements[i].column);
            }
        }
        return this.createGenericType('Vec', [firstType]);
    }
    inferBlockType(expr, context, uri) {
        const statements = expr.value || [];
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
    parseTypeExpression(typeExpr) {
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
    lookupType(name) {
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
    lookupVariableType(name, context, range, line, column) {
        const type = context.variables.get(name);
        if (type) {
            return type;
        }
        this.addError(`Undefined variable: '${name}'`, range, line, column);
        return this.createErrorType();
    }
    checkTypeCompatibility(actual, expected, range, line, column) {
        if (!this.typesEqual(actual, expected)) {
            this.addError(`Type mismatch: expected '${expected.name}', got '${actual.name}'`, range, line, column);
        }
    }
    checkBooleanType(type, range, line, column) {
        if (type.name !== 'bool') {
            this.addError(`Expected boolean type, got '${type.name}'`, range, line, column);
        }
    }
    checkIterableType(type, range, line, column) {
        if (type.name !== 'Vec' && type.name !== 'string') {
            this.addError(`Expected iterable type (Vec or string), got '${type.name}'`, range, line, column);
        }
    }
    checkFunctionCall(functionType, args, context, uri, range, line, column) {
        if (args.length !== functionType.parameters.length) {
            this.addError(`Function expects ${functionType.parameters.length} arguments, got ${args.length}`, range, line, column);
            return;
        }
        for (let i = 0; i < args.length; i++) {
            const argType = this.inferExpressionType(args[i], context, uri);
            const paramType = functionType.parameters[i];
            this.checkTypeCompatibility(argType, paramType, args[i].range, args[i].line, args[i].column);
        }
    }
    inferArithmeticType(left, right, range, line, column) {
        if (left.name === 'float' || right.name === 'float') {
            return this.createPrimitiveType('float');
        }
        else if (left.name === 'int' && right.name === 'int') {
            return this.createPrimitiveType('int');
        }
        else {
            this.addError(`Cannot perform arithmetic on types '${left.name}' and '${right.name}'`, range, line, column);
            return this.createErrorType();
        }
    }
    lookupStructField(structType, fieldName, range, line, column) {
        // In a real implementation, you'd look up the actual struct definition
        // For now, return unknown type
        return this.createUnknownType();
    }
    lookupEnumVariant(enumType, variantName, range, line, column) {
        // In a real implementation, you'd look up the actual enum definition
        // For now, return unknown type
        return this.createUnknownType();
    }
    getArrayElementType(arrayType) {
        if (arrayType.name === 'Vec' && arrayType.genericArgs && arrayType.genericArgs.length > 0) {
            return arrayType.genericArgs[0];
        }
        else if (arrayType.name === 'string') {
            return this.createPrimitiveType('char');
        }
        return this.createUnknownType();
    }
    typesEqual(a, b) {
        if (a.kind !== b.kind)
            return false;
        if (a.name !== b.name)
            return false;
        if (a.isReference !== b.isReference)
            return false;
        if (a.isMutable !== b.isMutable)
            return false;
        if (a.genericArgs && b.genericArgs) {
            if (a.genericArgs.length !== b.genericArgs.length)
                return false;
            for (let i = 0; i < a.genericArgs.length; i++) {
                if (!this.typesEqual(a.genericArgs[i], b.genericArgs[i]))
                    return false;
            }
        }
        else if (a.genericArgs || b.genericArgs) {
            return false;
        }
        return true;
    }
    createPrimitiveType(name) {
        return { kind: TypeKind.PRIMITIVE, name };
    }
    createStructType(name, genericArgs) {
        return { kind: TypeKind.STRUCT, name, genericArgs };
    }
    createEnumType(name, genericArgs) {
        return { kind: TypeKind.ENUM, name, genericArgs };
    }
    createFunctionType(parameters, returnType, isAsync = false) {
        return { kind: TypeKind.FUNCTION, name: 'function', genericArgs: parameters, isAsync };
    }
    createGenericType(name, genericArgs) {
        return { kind: TypeKind.GENERIC, name, genericArgs };
    }
    createUnknownType() {
        return { kind: TypeKind.UNKNOWN, name: 'unknown' };
    }
    createErrorType() {
        return { kind: TypeKind.ERROR, name: 'error' };
    }
    addError(message, range, line, column) {
        this.errors.push({
            message,
            range,
            line,
            column
        });
    }
}
exports.TypeChecker = TypeChecker;
//# sourceMappingURL=typeChecker.js.map