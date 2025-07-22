"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = exports.StatementKind = exports.ExpressionKind = void 0;
const lexer_1 = require("./lexer");
var ExpressionKind;
(function (ExpressionKind) {
    ExpressionKind["LITERAL"] = "literal";
    ExpressionKind["IDENTIFIER"] = "identifier";
    ExpressionKind["BINARY"] = "binary";
    ExpressionKind["UNARY"] = "unary";
    ExpressionKind["CALL"] = "call";
    ExpressionKind["MEMBER_ACCESS"] = "member_access";
    ExpressionKind["INDEX_ACCESS"] = "index_access";
    ExpressionKind["PARENTHESIZED"] = "parenthesized";
    ExpressionKind["ARRAY"] = "array";
    ExpressionKind["STRUCT_LITERAL"] = "struct_literal";
    ExpressionKind["MATCH"] = "match";
    ExpressionKind["IF"] = "if";
    ExpressionKind["BLOCK"] = "block";
})(ExpressionKind || (exports.ExpressionKind = ExpressionKind = {}));
var StatementKind;
(function (StatementKind) {
    StatementKind["EXPRESSION"] = "expression";
    StatementKind["IF"] = "if";
    StatementKind["FOR"] = "for";
    StatementKind["WHILE"] = "while";
    StatementKind["MATCH"] = "match";
    StatementKind["RETURN"] = "return";
    StatementKind["BREAK"] = "break";
    StatementKind["CONTINUE"] = "continue";
    StatementKind["FUNCTION"] = "function";
    StatementKind["STRUCT"] = "struct";
    StatementKind["ENUM"] = "enum";
    StatementKind["VARIABLE"] = "variable";
    StatementKind["IMPORT"] = "import";
    StatementKind["TRAIT"] = "trait";
    StatementKind["IMPL"] = "impl";
    StatementKind["MODULE"] = "module";
})(StatementKind || (exports.StatementKind = StatementKind = {}));
class Parser {
    constructor() {
        this.tokens = [];
        this.current = 0;
        this.errors = [];
    }
    parse(source) {
        const lexer = new lexer_1.Lexer(source);
        const lexResult = lexer.tokenize();
        this.tokens = lexResult.tokens;
        this.current = 0;
        this.errors = [];
        // Convert lexer errors to parse errors
        this.errors.push(...lexResult.errors.map(error => ({
            message: error.message,
            line: error.line,
            column: error.column,
            offset: error.offset
        })));
        const ast = [];
        while (!this.isAtEnd()) {
            try {
                const node = this.parseTopLevel();
                if (node) {
                    ast.push(node);
                }
            }
            catch (error) {
                this.synchronize();
            }
        }
        return { ast, errors: this.errors };
    }
    parseTopLevel() {
        const token = this.peek();
        switch (token.type) {
            case lexer_1.TokenType.FN:
                return this.parseFunctionDeclaration();
            case lexer_1.TokenType.STRUCT:
                return this.parseStructDeclaration();
            case lexer_1.TokenType.ENUM:
                return this.parseEnumDeclaration();
            case lexer_1.TokenType.LET:
            case lexer_1.TokenType.CONST:
                return this.parseVariableDeclaration();
            case lexer_1.TokenType.IMPORT:
                return this.parseImportStatement();
            case lexer_1.TokenType.TRAIT:
                return this.parseTraitDeclaration();
            case lexer_1.TokenType.IMPL:
                return this.parseImplDeclaration();
            case lexer_1.TokenType.MOD:
                return this.parseModuleDeclaration();
            case lexer_1.TokenType.IF:
                return this.parseIfStatement();
            case lexer_1.TokenType.FOR:
                return this.parseForStatement();
            case lexer_1.TokenType.WHILE:
                return this.parseWhileStatement();
            case lexer_1.TokenType.MATCH:
                return this.parseMatchStatement();
            case lexer_1.TokenType.RETURN:
                return this.parseReturnStatement();
            case lexer_1.TokenType.BREAK:
            case lexer_1.TokenType.CONTINUE:
                return this.parseBreakContinueStatement();
            default:
                // Try to parse as expression statement
                const expr = this.parseExpression();
                if (expr) {
                    this.expectSemicolon();
                    return {
                        type: 'statement',
                        kind: StatementKind.EXPRESSION,
                        expression: expr,
                        range: { start: expr.range.start, end: expr.range.end },
                        line: expr.line,
                        column: expr.column
                    };
                }
                return null;
        }
    }
    parseFunctionDeclaration() {
        const start = this.current;
        const startToken = this.advance(); // consume 'fn'
        let isAsync = false;
        if (this.check(lexer_1.TokenType.ASYNC)) {
            this.advance(); // consume 'async'
            isAsync = true;
        }
        const name = this.expectIdentifier();
        this.expect(lexer_1.TokenType.LEFT_PAREN);
        const parameters = [];
        if (!this.check(lexer_1.TokenType.RIGHT_PAREN)) {
            do {
                const paramName = this.expectIdentifier();
                this.expect(lexer_1.TokenType.COLON);
                const paramType = this.parseTypeExpression();
                parameters.push({ name: paramName, type: paramType });
            } while (this.match(lexer_1.TokenType.COMMA));
        }
        this.expect(lexer_1.TokenType.RIGHT_PAREN);
        let returnType;
        if (this.match(lexer_1.TokenType.ARROW)) {
            returnType = this.parseTypeExpression();
        }
        this.expect(lexer_1.TokenType.LEFT_BRACE);
        const body = this.parseBlock();
        this.expect(lexer_1.TokenType.RIGHT_BRACE);
        return {
            type: 'function',
            name,
            parameters,
            returnType,
            body,
            isAsync,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseStructDeclaration() {
        const startToken = this.advance(); // consume 'struct'
        const name = this.expectIdentifier();
        let generics;
        if (this.match(lexer_1.TokenType.LESS)) {
            generics = this.parseTypeParameters();
            this.expect(lexer_1.TokenType.GREATER);
        }
        this.expect(lexer_1.TokenType.LEFT_BRACE);
        const fields = [];
        while (!this.check(lexer_1.TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const fieldName = this.expectIdentifier();
            this.expect(lexer_1.TokenType.COLON);
            const fieldType = this.parseTypeExpression();
            fields.push({ name: fieldName, type: fieldType });
            if (!this.match(lexer_1.TokenType.COMMA)) {
                break;
            }
        }
        this.expect(lexer_1.TokenType.RIGHT_BRACE);
        return {
            type: 'struct',
            name,
            fields,
            generics,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseEnumDeclaration() {
        const startToken = this.advance(); // consume 'enum'
        const name = this.expectIdentifier();
        let generics;
        if (this.match(lexer_1.TokenType.LESS)) {
            generics = this.parseTypeParameters();
            this.expect(lexer_1.TokenType.GREATER);
        }
        this.expect(lexer_1.TokenType.LEFT_BRACE);
        const variants = [];
        while (!this.check(lexer_1.TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const variantName = this.expectIdentifier();
            let fields;
            if (this.match(lexer_1.TokenType.LEFT_PAREN)) {
                fields = [];
                if (!this.check(lexer_1.TokenType.RIGHT_PAREN)) {
                    do {
                        const fieldName = this.expectIdentifier();
                        this.expect(lexer_1.TokenType.COLON);
                        const fieldType = this.parseTypeExpression();
                        fields.push({ name: fieldName, type: fieldType });
                    } while (this.match(lexer_1.TokenType.COMMA));
                }
                this.expect(lexer_1.TokenType.RIGHT_PAREN);
            }
            variants.push({ name: variantName, fields });
            if (!this.match(lexer_1.TokenType.COMMA)) {
                break;
            }
        }
        this.expect(lexer_1.TokenType.RIGHT_BRACE);
        return {
            type: 'enum',
            name,
            variants,
            generics,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseVariableDeclaration() {
        const startToken = this.advance(); // consume 'let' or 'const'
        const isConst = startToken.type === lexer_1.TokenType.CONST;
        const name = this.expectIdentifier();
        let varType;
        if (this.match(lexer_1.TokenType.COLON)) {
            varType = this.parseTypeExpression();
        }
        let value;
        if (this.match(lexer_1.TokenType.ASSIGN)) {
            value = this.parseExpression();
        }
        this.expectSemicolon();
        return {
            type: 'variable',
            name,
            varType,
            value,
            isConst,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseTypeExpression() {
        const startToken = this.peek();
        let isReference = false;
        let isMutable = false;
        if (this.match(lexer_1.TokenType.AND)) {
            isReference = true;
            if (this.match(lexer_1.TokenType.IDENTIFIER) && this.previous().value === 'mut') {
                isMutable = true;
            }
        }
        const baseType = this.expectIdentifier();
        let genericArgs;
        if (this.match(lexer_1.TokenType.LESS)) {
            genericArgs = [];
            if (!this.check(lexer_1.TokenType.GREATER)) {
                do {
                    genericArgs.push(this.parseTypeExpression());
                } while (this.match(lexer_1.TokenType.COMMA));
            }
            this.expect(lexer_1.TokenType.GREATER);
        }
        return {
            type: 'type_expression',
            baseType,
            genericArgs,
            isReference,
            isMutable,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseTypeParameters() {
        const parameters = [];
        do {
            const name = this.expectIdentifier();
            let constraint;
            if (this.match(lexer_1.TokenType.COLON)) {
                constraint = this.parseTypeExpression();
            }
            parameters.push({ name, constraint });
        } while (this.match(lexer_1.TokenType.COMMA));
        return parameters;
    }
    parseExpression() {
        return this.parseAssignment();
    }
    parseAssignment() {
        const expr = this.parseOr();
        if (this.match(lexer_1.TokenType.ASSIGN, lexer_1.TokenType.PLUS_ASSIGN, lexer_1.TokenType.MINUS_ASSIGN, lexer_1.TokenType.STAR_ASSIGN, lexer_1.TokenType.SLASH_ASSIGN, lexer_1.TokenType.PERCENT_ASSIGN)) {
            const operator = this.previous().value;
            const value = this.parseAssignment();
            return {
                type: 'expression',
                kind: ExpressionKind.BINARY,
                operator,
                left: expr,
                right: value,
                range: { start: expr.range.start, end: value.range.end },
                line: expr.line,
                column: expr.column
            };
        }
        return expr;
    }
    parseOr() {
        let expr = this.parseAnd();
        while (this.match(lexer_1.TokenType.OR)) {
            const operator = this.previous().value;
            const right = this.parseAnd();
            expr = {
                type: 'expression',
                kind: ExpressionKind.BINARY,
                operator,
                left: expr,
                right,
                range: { start: expr.range.start, end: right.range.end },
                line: expr.line,
                column: expr.column
            };
        }
        return expr;
    }
    parseAnd() {
        let expr = this.parseEquality();
        while (this.match(lexer_1.TokenType.AND)) {
            const operator = this.previous().value;
            const right = this.parseEquality();
            expr = {
                type: 'expression',
                kind: ExpressionKind.BINARY,
                operator,
                left: expr,
                right,
                range: { start: expr.range.start, end: right.range.end },
                line: expr.line,
                column: expr.column
            };
        }
        return expr;
    }
    parseEquality() {
        let expr = this.parseComparison();
        while (this.match(lexer_1.TokenType.EQUAL, lexer_1.TokenType.NOT_EQUAL)) {
            const operator = this.previous().value;
            const right = this.parseComparison();
            expr = {
                type: 'expression',
                kind: ExpressionKind.BINARY,
                operator,
                left: expr,
                right,
                range: { start: expr.range.start, end: right.range.end },
                line: expr.line,
                column: expr.column
            };
        }
        return expr;
    }
    parseComparison() {
        let expr = this.parseTerm();
        while (this.match(lexer_1.TokenType.LESS, lexer_1.TokenType.LESS_EQUAL, lexer_1.TokenType.GREATER, lexer_1.TokenType.GREATER_EQUAL)) {
            const operator = this.previous().value;
            const right = this.parseTerm();
            expr = {
                type: 'expression',
                kind: ExpressionKind.BINARY,
                operator,
                left: expr,
                right,
                range: { start: expr.range.start, end: right.range.end },
                line: expr.line,
                column: expr.column
            };
        }
        return expr;
    }
    parseTerm() {
        let expr = this.parseFactor();
        while (this.match(lexer_1.TokenType.PLUS, lexer_1.TokenType.MINUS)) {
            const operator = this.previous().value;
            const right = this.parseFactor();
            expr = {
                type: 'expression',
                kind: ExpressionKind.BINARY,
                operator,
                left: expr,
                right,
                range: { start: expr.range.start, end: right.range.end },
                line: expr.line,
                column: expr.column
            };
        }
        return expr;
    }
    parseFactor() {
        let expr = this.parseUnary();
        while (this.match(lexer_1.TokenType.STAR, lexer_1.TokenType.SLASH, lexer_1.TokenType.PERCENT)) {
            const operator = this.previous().value;
            const right = this.parseUnary();
            expr = {
                type: 'expression',
                kind: ExpressionKind.BINARY,
                operator,
                left: expr,
                right,
                range: { start: expr.range.start, end: right.range.end },
                line: expr.line,
                column: expr.column
            };
        }
        return expr;
    }
    parseUnary() {
        if (this.match(lexer_1.TokenType.NOT, lexer_1.TokenType.MINUS)) {
            const operator = this.previous().value;
            const right = this.parseUnary();
            return {
                type: 'expression',
                kind: ExpressionKind.UNARY,
                operator,
                right,
                range: { start: this.previous().offset, end: right.range.end },
                line: this.previous().line,
                column: this.previous().column
            };
        }
        return this.parseCall();
    }
    parseCall() {
        let expr = this.parsePrimary();
        while (true) {
            if (this.match(lexer_1.TokenType.LEFT_PAREN)) {
                expr = this.finishCall(expr);
            }
            else if (this.match(lexer_1.TokenType.DOT)) {
                const name = this.expectIdentifier();
                expr = {
                    type: 'expression',
                    kind: ExpressionKind.MEMBER_ACCESS,
                    left: expr,
                    value: name,
                    range: { start: expr.range.start, end: this.previous().offset + this.previous().value.length },
                    line: expr.line,
                    column: expr.column
                };
            }
            else if (this.match(lexer_1.TokenType.LEFT_BRACKET)) {
                const index = this.parseExpression();
                this.expect(lexer_1.TokenType.RIGHT_BRACKET);
                expr = {
                    type: 'expression',
                    kind: ExpressionKind.INDEX_ACCESS,
                    left: expr,
                    right: index,
                    range: { start: expr.range.start, end: this.previous().offset + this.previous().value.length },
                    line: expr.line,
                    column: expr.column
                };
            }
            else {
                break;
            }
        }
        return expr;
    }
    finishCall(callee) {
        const args = [];
        if (!this.check(lexer_1.TokenType.RIGHT_PAREN)) {
            do {
                args.push(this.parseExpression());
            } while (this.match(lexer_1.TokenType.COMMA));
        }
        this.expect(lexer_1.TokenType.RIGHT_PAREN);
        return {
            type: 'expression',
            kind: ExpressionKind.CALL,
            left: callee,
            value: args,
            range: { start: callee.range.start, end: this.previous().offset + this.previous().value.length },
            line: callee.line,
            column: callee.column
        };
    }
    parsePrimary() {
        if (this.match(lexer_1.TokenType.BOOLEAN_LITERAL, lexer_1.TokenType.INTEGER_LITERAL, lexer_1.TokenType.FLOAT_LITERAL, lexer_1.TokenType.STRING_LITERAL, lexer_1.TokenType.CHAR_LITERAL)) {
            const token = this.previous();
            return {
                type: 'expression',
                kind: ExpressionKind.LITERAL,
                value: token.value,
                range: { start: token.offset, end: token.offset + token.value.length },
                line: token.line,
                column: token.column
            };
        }
        if (this.match(lexer_1.TokenType.IDENTIFIER)) {
            const token = this.previous();
            return {
                type: 'expression',
                kind: ExpressionKind.IDENTIFIER,
                value: token.value,
                range: { start: token.offset, end: token.offset + token.value.length },
                line: token.line,
                column: token.column
            };
        }
        if (this.match(lexer_1.TokenType.LEFT_PAREN)) {
            const expr = this.parseExpression();
            this.expect(lexer_1.TokenType.RIGHT_PAREN);
            return {
                type: 'expression',
                kind: ExpressionKind.PARENTHESIZED,
                value: expr,
                range: { start: expr.range.start, end: this.previous().offset + this.previous().value.length },
                line: expr.line,
                column: expr.column
            };
        }
        if (this.match(lexer_1.TokenType.LEFT_BRACKET)) {
            return this.parseArrayLiteral();
        }
        if (this.match(lexer_1.TokenType.LEFT_BRACE)) {
            return this.parseBlockExpression();
        }
        this.error('Expected expression');
        return this.parsePrimary(); // Recursive call to handle error
    }
    parseArrayLiteral() {
        const startToken = this.previous();
        const elements = [];
        if (!this.check(lexer_1.TokenType.RIGHT_BRACKET)) {
            do {
                elements.push(this.parseExpression());
            } while (this.match(lexer_1.TokenType.COMMA));
        }
        this.expect(lexer_1.TokenType.RIGHT_BRACKET);
        return {
            type: 'expression',
            kind: ExpressionKind.ARRAY,
            value: elements,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseBlockExpression() {
        const startToken = this.previous();
        const statements = this.parseBlock();
        return {
            type: 'expression',
            kind: ExpressionKind.BLOCK,
            value: statements,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseBlock() {
        const statements = [];
        while (!this.check(lexer_1.TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const stmt = this.parseTopLevel();
            if (stmt) {
                statements.push(stmt);
            }
        }
        return statements;
    }
    parseIfStatement() {
        const startToken = this.advance(); // consume 'if'
        this.expect(lexer_1.TokenType.LEFT_PAREN);
        const condition = this.parseExpression();
        this.expect(lexer_1.TokenType.RIGHT_PAREN);
        this.expect(lexer_1.TokenType.LEFT_BRACE);
        const thenBody = this.parseBlock();
        this.expect(lexer_1.TokenType.RIGHT_BRACE);
        let elseBody;
        if (this.match(lexer_1.TokenType.ELSE)) {
            this.expect(lexer_1.TokenType.LEFT_BRACE);
            elseBody = this.parseBlock();
            this.expect(lexer_1.TokenType.RIGHT_BRACE);
        }
        return {
            type: 'statement',
            kind: StatementKind.IF,
            condition,
            thenBody,
            elseBody,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseForStatement() {
        const startToken = this.advance(); // consume 'for'
        const item = this.expectIdentifier();
        this.expect(lexer_1.TokenType.IDENTIFIER); // 'in'
        const collection = this.parseExpression();
        this.expect(lexer_1.TokenType.LEFT_BRACE);
        const body = this.parseBlock();
        this.expect(lexer_1.TokenType.RIGHT_BRACE);
        return {
            type: 'statement',
            kind: StatementKind.FOR,
            item,
            collection,
            body,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseWhileStatement() {
        const startToken = this.advance(); // consume 'while'
        this.expect(lexer_1.TokenType.LEFT_PAREN);
        const condition = this.parseExpression();
        this.expect(lexer_1.TokenType.RIGHT_PAREN);
        this.expect(lexer_1.TokenType.LEFT_BRACE);
        const body = this.parseBlock();
        this.expect(lexer_1.TokenType.RIGHT_BRACE);
        return {
            type: 'statement',
            kind: StatementKind.WHILE,
            condition,
            body,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseMatchStatement() {
        const startToken = this.advance(); // consume 'match'
        const expression = this.parseExpression();
        this.expect(lexer_1.TokenType.LEFT_BRACE);
        const cases = [];
        while (!this.check(lexer_1.TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const pattern = this.parseExpression();
            let guard;
            if (this.match(lexer_1.TokenType.IF)) {
                guard = this.parseExpression();
            }
            this.expect(lexer_1.TokenType.ARROW);
            this.expect(lexer_1.TokenType.LEFT_BRACE);
            const body = this.parseBlock();
            this.expect(lexer_1.TokenType.RIGHT_BRACE);
            cases.push({ pattern, guard, body });
            if (!this.match(lexer_1.TokenType.COMMA)) {
                break;
            }
        }
        this.expect(lexer_1.TokenType.RIGHT_BRACE);
        return {
            type: 'statement',
            kind: StatementKind.MATCH,
            expression,
            cases,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseReturnStatement() {
        const startToken = this.advance(); // consume 'return'
        let value;
        if (!this.check(lexer_1.TokenType.SEMICOLON)) {
            value = this.parseExpression();
        }
        this.expectSemicolon();
        return {
            type: 'statement',
            kind: StatementKind.RETURN,
            value,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseBreakContinueStatement() {
        const startToken = this.advance(); // consume 'break' or 'continue'
        this.expectSemicolon();
        return {
            type: 'statement',
            kind: startToken.type === lexer_1.TokenType.BREAK ? StatementKind.BREAK : StatementKind.CONTINUE,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseImportStatement() {
        const startToken = this.advance(); // consume 'import'
        const module = this.expectIdentifier();
        let itemName;
        if (this.match(lexer_1.TokenType.DOUBLE_COLON)) {
            itemName = this.expectIdentifier();
        }
        this.expectSemicolon();
        return {
            type: 'statement',
            kind: StatementKind.IMPORT,
            module,
            itemName,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseTraitDeclaration() {
        const startToken = this.advance(); // consume 'trait'
        const name = this.expectIdentifier();
        let generics;
        if (this.match(lexer_1.TokenType.LESS)) {
            generics = this.parseTypeParameters();
            this.expect(lexer_1.TokenType.GREATER);
        }
        this.expect(lexer_1.TokenType.LEFT_BRACE);
        const methods = this.parseTraitMethods();
        this.expect(lexer_1.TokenType.RIGHT_BRACE);
        return {
            type: 'statement',
            kind: StatementKind.TRAIT,
            name,
            generics,
            methods,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseImplDeclaration() {
        const startToken = this.advance(); // consume 'impl'
        const trait = this.expectIdentifier();
        this.expect(lexer_1.TokenType.IDENTIFIER); // 'for'
        const implType = this.parseTypeExpression();
        this.expect(lexer_1.TokenType.LEFT_BRACE);
        const methods = this.parseTraitMethods();
        this.expect(lexer_1.TokenType.RIGHT_BRACE);
        return {
            type: 'statement',
            kind: StatementKind.IMPL,
            trait,
            implType,
            methods,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseModuleDeclaration() {
        const startToken = this.advance(); // consume 'mod'
        const name = this.expectIdentifier();
        this.expect(lexer_1.TokenType.LEFT_BRACE);
        const body = this.parseBlock();
        this.expect(lexer_1.TokenType.RIGHT_BRACE);
        return {
            type: 'statement',
            kind: StatementKind.MODULE,
            name,
            body,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }
    parseTraitMethods() {
        const methods = [];
        while (!this.check(lexer_1.TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const method = this.parseFunctionDeclaration();
            methods.push(method);
        }
        return methods;
    }
    // Helper methods
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
    }
    advance() {
        if (!this.isAtEnd())
            this.current++;
        return this.previous();
    }
    isAtEnd() {
        return this.peek().type === lexer_1.TokenType.EOF;
    }
    peek() {
        return this.tokens[this.current];
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    expect(type) {
        if (this.check(type))
            return this.advance();
        const token = this.peek();
        this.error(`Expected ${type}, got ${token.type}`);
        return token;
    }
    expectIdentifier() {
        const token = this.expect(lexer_1.TokenType.IDENTIFIER);
        return token.value;
    }
    expectSemicolon() {
        if (this.check(lexer_1.TokenType.SEMICOLON)) {
            this.advance();
        }
        else {
            this.error('Expected semicolon');
        }
    }
    error(message) {
        const token = this.peek();
        this.errors.push({
            message,
            line: token.line,
            column: token.column,
            offset: token.offset,
            token
        });
    }
    synchronize() {
        this.advance();
        while (!this.isAtEnd()) {
            if (this.previous().type === lexer_1.TokenType.SEMICOLON)
                return;
            switch (this.peek().type) {
                case lexer_1.TokenType.FN:
                case lexer_1.TokenType.STRUCT:
                case lexer_1.TokenType.ENUM:
                case lexer_1.TokenType.LET:
                case lexer_1.TokenType.CONST:
                case lexer_1.TokenType.IF:
                case lexer_1.TokenType.FOR:
                case lexer_1.TokenType.WHILE:
                case lexer_1.TokenType.RETURN:
                    return;
            }
            this.advance();
        }
    }
}
exports.Parser = Parser;
//# sourceMappingURL=parser.js.map