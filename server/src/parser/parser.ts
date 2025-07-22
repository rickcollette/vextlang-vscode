import { Lexer, Token, TokenType, LexerError } from './lexer';

export interface ASTNode {
    type: string;
    range: { start: number; end: number };
    line: number;
    column: number;
    children?: ASTNode[];
    kind?: string;
}

export interface FunctionDeclaration extends ASTNode {
    type: 'function';
    name: string;
    parameters: Parameter[];
    returnType?: TypeExpression;
    body: Statement[];
    isAsync: boolean;
}

export interface StructDeclaration extends ASTNode {
    type: 'struct';
    name: string;
    fields: Field[];
    generics?: TypeParameter[];
}

export interface EnumDeclaration extends ASTNode {
    type: 'enum';
    name: string;
    variants: EnumVariant[];
    generics?: TypeParameter[];
}

export interface VariableDeclaration extends ASTNode {
    type: 'variable';
    name: string;
    varType?: TypeExpression;
    value?: Expression;
    isConst: boolean;
}

export interface Parameter {
    name: string;
    type: TypeExpression;
}

export interface Field {
    name: string;
    type: TypeExpression;
}

export interface EnumVariant {
    name: string;
    fields?: Field[];
}

export interface TypeParameter {
    name: string;
    constraint?: TypeExpression;
}

export interface TypeExpression extends ASTNode {
    type: 'type_expression';
    baseType: string;
    genericArgs?: TypeExpression[];
    isReference?: boolean;
    isMutable?: boolean;
}

export interface Expression extends ASTNode {
    type: 'expression';
    operator?: string;
    left?: Expression;
    right?: Expression;
    value?: any;
    kind: ExpressionKind;
}

export enum ExpressionKind {
    LITERAL = 'literal',
    IDENTIFIER = 'identifier',
    BINARY = 'binary',
    UNARY = 'unary',
    CALL = 'call',
    MEMBER_ACCESS = 'member_access',
    INDEX_ACCESS = 'index_access',
    PARENTHESIZED = 'parenthesized',
    ARRAY = 'array',
    STRUCT_LITERAL = 'struct_literal',
    MATCH = 'match',
    IF = 'if',
    BLOCK = 'block'
}

export interface Statement extends ASTNode {
    type: 'statement';
    kind: StatementKind;
    expression?: Expression;
    condition?: Expression;
    thenBody?: Statement[];
    elseBody?: Statement[];
    body?: Statement[];
    cases?: MatchCase[];
    item?: string;
    collection?: Expression;
    value?: Expression;
    name?: string;
    parameters?: Parameter[];
    returnType?: TypeExpression;
    fields?: Field[];
    variants?: EnumVariant[];
    trait?: string;
    implType?: TypeExpression;
    methods?: FunctionDeclaration[];
    module?: string;
    itemName?: string;
    generics?: TypeParameter[];
}

export enum StatementKind {
    EXPRESSION = 'expression',
    IF = 'if',
    FOR = 'for',
    WHILE = 'while',
    MATCH = 'match',
    RETURN = 'return',
    BREAK = 'break',
    CONTINUE = 'continue',
    FUNCTION = 'function',
    STRUCT = 'struct',
    ENUM = 'enum',
    VARIABLE = 'variable',
    IMPORT = 'import',
    TRAIT = 'trait',
    IMPL = 'impl',
    MODULE = 'module'
}

export interface MatchCase {
    pattern: Expression;
    guard?: Expression;
    body: Statement[];
}

export interface ParseError {
    message: string;
    line: number;
    column: number;
    offset: number;
    token?: Token;
}

export class Parser {
    private tokens: Token[] = [];
    private current = 0;
    private errors: ParseError[] = [];

    parse(source: string): { ast: ASTNode[]; errors: ParseError[] } {
        const lexer = new Lexer(source);
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

        const ast: ASTNode[] = [];

        while (!this.isAtEnd()) {
            try {
                const node = this.parseTopLevel();
                if (node) {
                    ast.push(node);
                }
            } catch (error) {
                this.synchronize();
            }
        }

        return { ast, errors: this.errors };
    }

    private parseTopLevel(): ASTNode | null {
        const token = this.peek();

        switch (token.type) {
            case TokenType.FN:
                return this.parseFunctionDeclaration();
            case TokenType.STRUCT:
                return this.parseStructDeclaration();
            case TokenType.ENUM:
                return this.parseEnumDeclaration();
            case TokenType.LET:
            case TokenType.CONST:
                return this.parseVariableDeclaration();
            case TokenType.IMPORT:
                return this.parseImportStatement();
            case TokenType.TRAIT:
                return this.parseTraitDeclaration();
            case TokenType.IMPL:
                return this.parseImplDeclaration();
            case TokenType.MOD:
                return this.parseModuleDeclaration();
            case TokenType.IF:
                return this.parseIfStatement();
            case TokenType.FOR:
                return this.parseForStatement();
            case TokenType.WHILE:
                return this.parseWhileStatement();
            case TokenType.MATCH:
                return this.parseMatchStatement();
            case TokenType.RETURN:
                return this.parseReturnStatement();
            case TokenType.BREAK:
            case TokenType.CONTINUE:
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
                    } as Statement;
                }
                return null;
        }
    }

    private parseFunctionDeclaration(): FunctionDeclaration {
        const start = this.current;
        const startToken = this.advance(); // consume 'fn'

        let isAsync = false;
        if (this.check(TokenType.ASYNC)) {
            this.advance(); // consume 'async'
            isAsync = true;
        }

        const name = this.expectIdentifier();
        this.expect(TokenType.LEFT_PAREN);

        const parameters: Parameter[] = [];
        if (!this.check(TokenType.RIGHT_PAREN)) {
            do {
                const paramName = this.expectIdentifier();
                this.expect(TokenType.COLON);
                const paramType = this.parseTypeExpression();
                parameters.push({ name: paramName, type: paramType });
            } while (this.match(TokenType.COMMA));
        }

        this.expect(TokenType.RIGHT_PAREN);

        let returnType: TypeExpression | undefined;
        if (this.match(TokenType.ARROW)) {
            returnType = this.parseTypeExpression();
        }

        this.expect(TokenType.LEFT_BRACE);
        const body = this.parseBlock();
        this.expect(TokenType.RIGHT_BRACE);

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

    private parseStructDeclaration(): StructDeclaration {
        const startToken = this.advance(); // consume 'struct'
        const name = this.expectIdentifier();

        let generics: TypeParameter[] | undefined;
        if (this.match(TokenType.LESS)) {
            generics = this.parseTypeParameters();
            this.expect(TokenType.GREATER);
        }

        this.expect(TokenType.LEFT_BRACE);

        const fields: Field[] = [];
        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const fieldName = this.expectIdentifier();
            this.expect(TokenType.COLON);
            const fieldType = this.parseTypeExpression();
            fields.push({ name: fieldName, type: fieldType });

            if (!this.match(TokenType.COMMA)) {
                break;
            }
        }

        this.expect(TokenType.RIGHT_BRACE);

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

    private parseEnumDeclaration(): EnumDeclaration {
        const startToken = this.advance(); // consume 'enum'
        const name = this.expectIdentifier();

        let generics: TypeParameter[] | undefined;
        if (this.match(TokenType.LESS)) {
            generics = this.parseTypeParameters();
            this.expect(TokenType.GREATER);
        }

        this.expect(TokenType.LEFT_BRACE);

        const variants: EnumVariant[] = [];
        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const variantName = this.expectIdentifier();

            let fields: Field[] | undefined;
            if (this.match(TokenType.LEFT_PAREN)) {
                fields = [];
                if (!this.check(TokenType.RIGHT_PAREN)) {
                    do {
                        const fieldName = this.expectIdentifier();
                        this.expect(TokenType.COLON);
                        const fieldType = this.parseTypeExpression();
                        fields.push({ name: fieldName, type: fieldType });
                    } while (this.match(TokenType.COMMA));
                }
                this.expect(TokenType.RIGHT_PAREN);
            }

            variants.push({ name: variantName, fields });

            if (!this.match(TokenType.COMMA)) {
                break;
            }
        }

        this.expect(TokenType.RIGHT_BRACE);

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

    private parseVariableDeclaration(): VariableDeclaration {
        const startToken = this.advance(); // consume 'let' or 'const'
        const isConst = startToken.type === TokenType.CONST;
        const name = this.expectIdentifier();

                let varType: TypeExpression | undefined;
        if (this.match(TokenType.COLON)) {
            varType = this.parseTypeExpression();
        }
        
        let value: Expression | undefined;
        if (this.match(TokenType.ASSIGN)) {
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

    private parseTypeExpression(): TypeExpression {
        const startToken = this.peek();

        let isReference = false;
        let isMutable = false;

        if (this.match(TokenType.AND)) {
            isReference = true;
            if (this.match(TokenType.IDENTIFIER) && this.previous().value === 'mut') {
                isMutable = true;
            }
        }

        const baseType = this.expectIdentifier();

        let genericArgs: TypeExpression[] | undefined;
        if (this.match(TokenType.LESS)) {
            genericArgs = [];
            if (!this.check(TokenType.GREATER)) {
                do {
                    genericArgs.push(this.parseTypeExpression());
                } while (this.match(TokenType.COMMA));
            }
            this.expect(TokenType.GREATER);
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

    private parseTypeParameters(): TypeParameter[] {
        const parameters: TypeParameter[] = [];

        do {
            const name = this.expectIdentifier();
            let constraint: TypeExpression | undefined;

            if (this.match(TokenType.COLON)) {
                constraint = this.parseTypeExpression();
            }

            parameters.push({ name, constraint });
        } while (this.match(TokenType.COMMA));

        return parameters;
    }

    private parseExpression(): Expression {
        return this.parseAssignment();
    }

    private parseAssignment(): Expression {
        const expr = this.parseOr();

        if (this.match(TokenType.ASSIGN, TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN,
            TokenType.STAR_ASSIGN, TokenType.SLASH_ASSIGN, TokenType.PERCENT_ASSIGN)) {
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

    private parseOr(): Expression {
        let expr = this.parseAnd();

        while (this.match(TokenType.OR)) {
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

    private parseAnd(): Expression {
        let expr = this.parseEquality();

        while (this.match(TokenType.AND)) {
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

    private parseEquality(): Expression {
        let expr = this.parseComparison();

        while (this.match(TokenType.EQUAL, TokenType.NOT_EQUAL)) {
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

    private parseComparison(): Expression {
        let expr = this.parseTerm();

        while (this.match(TokenType.LESS, TokenType.LESS_EQUAL, TokenType.GREATER, TokenType.GREATER_EQUAL)) {
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

    private parseTerm(): Expression {
        let expr = this.parseFactor();

        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
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

    private parseFactor(): Expression {
        let expr = this.parseUnary();

        while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
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

    private parseUnary(): Expression {
        if (this.match(TokenType.NOT, TokenType.MINUS)) {
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

    private parseCall(): Expression {
        let expr = this.parsePrimary();

        while (true) {
            if (this.match(TokenType.LEFT_PAREN)) {
                expr = this.finishCall(expr);
            } else if (this.match(TokenType.DOT)) {
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
            } else if (this.match(TokenType.LEFT_BRACKET)) {
                const index = this.parseExpression();
                this.expect(TokenType.RIGHT_BRACKET);
                expr = {
                    type: 'expression',
                    kind: ExpressionKind.INDEX_ACCESS,
                    left: expr,
                    right: index,
                    range: { start: expr.range.start, end: this.previous().offset + this.previous().value.length },
                    line: expr.line,
                    column: expr.column
                };
            } else {
                break;
            }
        }

        return expr;
    }

    private finishCall(callee: Expression): Expression {
        const args: Expression[] = [];

        if (!this.check(TokenType.RIGHT_PAREN)) {
            do {
                args.push(this.parseExpression());
            } while (this.match(TokenType.COMMA));
        }

        this.expect(TokenType.RIGHT_PAREN);

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

    private parsePrimary(): Expression {
        if (this.match(TokenType.BOOLEAN_LITERAL, TokenType.INTEGER_LITERAL, TokenType.FLOAT_LITERAL,
            TokenType.STRING_LITERAL, TokenType.CHAR_LITERAL)) {
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

        if (this.match(TokenType.IDENTIFIER)) {
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

        if (this.match(TokenType.LEFT_PAREN)) {
            const expr = this.parseExpression();
            this.expect(TokenType.RIGHT_PAREN);

            return {
                type: 'expression',
                kind: ExpressionKind.PARENTHESIZED,
                value: expr,
                range: { start: expr.range.start, end: this.previous().offset + this.previous().value.length },
                line: expr.line,
                column: expr.column
            };
        }

        if (this.match(TokenType.LEFT_BRACKET)) {
            return this.parseArrayLiteral();
        }

        if (this.match(TokenType.LEFT_BRACE)) {
            return this.parseBlockExpression();
        }

        this.error('Expected expression');
        return this.parsePrimary(); // Recursive call to handle error
    }

    private parseArrayLiteral(): Expression {
        const startToken = this.previous();
        const elements: Expression[] = [];

        if (!this.check(TokenType.RIGHT_BRACKET)) {
            do {
                elements.push(this.parseExpression());
            } while (this.match(TokenType.COMMA));
        }

        this.expect(TokenType.RIGHT_BRACKET);

        return {
            type: 'expression',
            kind: ExpressionKind.ARRAY,
            value: elements,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }

    private parseBlockExpression(): Expression {
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

    private parseBlock(): Statement[] {
        const statements: Statement[] = [];

        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const stmt = this.parseTopLevel();
            if (stmt) {
                statements.push(stmt as Statement);
            }
        }

        return statements;
    }

    private parseIfStatement(): Statement {
        const startToken = this.advance(); // consume 'if'
        this.expect(TokenType.LEFT_PAREN);
        const condition = this.parseExpression();
        this.expect(TokenType.RIGHT_PAREN);

        this.expect(TokenType.LEFT_BRACE);
        const thenBody = this.parseBlock();
        this.expect(TokenType.RIGHT_BRACE);

        let elseBody: Statement[] | undefined;
        if (this.match(TokenType.ELSE)) {
            this.expect(TokenType.LEFT_BRACE);
            elseBody = this.parseBlock();
            this.expect(TokenType.RIGHT_BRACE);
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

    private parseForStatement(): Statement {
        const startToken = this.advance(); // consume 'for'
        const item = this.expectIdentifier();
        this.expect(TokenType.IDENTIFIER); // 'in'
        const collection = this.parseExpression();

        this.expect(TokenType.LEFT_BRACE);
        const body = this.parseBlock();
        this.expect(TokenType.RIGHT_BRACE);

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

    private parseWhileStatement(): Statement {
        const startToken = this.advance(); // consume 'while'
        this.expect(TokenType.LEFT_PAREN);
        const condition = this.parseExpression();
        this.expect(TokenType.RIGHT_PAREN);

        this.expect(TokenType.LEFT_BRACE);
        const body = this.parseBlock();
        this.expect(TokenType.RIGHT_BRACE);

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

    private parseMatchStatement(): Statement {
        const startToken = this.advance(); // consume 'match'
        const expression = this.parseExpression();
        this.expect(TokenType.LEFT_BRACE);

        const cases: MatchCase[] = [];
        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const pattern = this.parseExpression();

            let guard: Expression | undefined;
            if (this.match(TokenType.IF)) {
                guard = this.parseExpression();
            }

            this.expect(TokenType.ARROW);
            this.expect(TokenType.LEFT_BRACE);
            const body = this.parseBlock();
            this.expect(TokenType.RIGHT_BRACE);

            cases.push({ pattern, guard, body });

            if (!this.match(TokenType.COMMA)) {
                break;
            }
        }

        this.expect(TokenType.RIGHT_BRACE);

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

    private parseReturnStatement(): Statement {
        const startToken = this.advance(); // consume 'return'

        let value: Expression | undefined;
        if (!this.check(TokenType.SEMICOLON)) {
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

    private parseBreakContinueStatement(): Statement {
        const startToken = this.advance(); // consume 'break' or 'continue'
        this.expectSemicolon();

        return {
            type: 'statement',
            kind: startToken.type === TokenType.BREAK ? StatementKind.BREAK : StatementKind.CONTINUE,
            range: { start: startToken.offset, end: this.previous().offset + this.previous().value.length },
            line: startToken.line,
            column: startToken.column
        };
    }

    private parseImportStatement(): Statement {
        const startToken = this.advance(); // consume 'import'
        const module = this.expectIdentifier();

        let itemName: string | undefined;
        if (this.match(TokenType.DOUBLE_COLON)) {
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

    private parseTraitDeclaration(): Statement {
        const startToken = this.advance(); // consume 'trait'
        const name = this.expectIdentifier();

        let generics: TypeParameter[] | undefined;
        if (this.match(TokenType.LESS)) {
            generics = this.parseTypeParameters();
            this.expect(TokenType.GREATER);
        }

        this.expect(TokenType.LEFT_BRACE);
        const methods = this.parseTraitMethods();
        this.expect(TokenType.RIGHT_BRACE);

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

    private parseImplDeclaration(): Statement {
        const startToken = this.advance(); // consume 'impl'
        const trait = this.expectIdentifier();
        this.expect(TokenType.IDENTIFIER); // 'for'
        const implType = this.parseTypeExpression();

        this.expect(TokenType.LEFT_BRACE);
        const methods = this.parseTraitMethods();
        this.expect(TokenType.RIGHT_BRACE);

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

    private parseModuleDeclaration(): Statement {
        const startToken = this.advance(); // consume 'mod'
        const name = this.expectIdentifier();

        this.expect(TokenType.LEFT_BRACE);
        const body = this.parseBlock();
        this.expect(TokenType.RIGHT_BRACE);

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

    private parseTraitMethods(): FunctionDeclaration[] {
        const methods: FunctionDeclaration[] = [];

        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const method = this.parseFunctionDeclaration();
            methods.push(method);
        }

        return methods;
    }

    // Helper methods
    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    private isAtEnd(): boolean {
        return this.peek().type === TokenType.EOF;
    }

    private peek(): Token {
        return this.tokens[this.current];
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private expect(type: TokenType): Token {
        if (this.check(type)) return this.advance();

        const token = this.peek();
        this.error(`Expected ${type}, got ${token.type}`);
        return token;
    }

    private expectIdentifier(): string {
        const token = this.expect(TokenType.IDENTIFIER);
        return token.value;
    }

    private expectSemicolon(): void {
        if (this.check(TokenType.SEMICOLON)) {
            this.advance();
        } else {
            this.error('Expected semicolon');
        }
    }

    private error(message: string): void {
        const token = this.peek();
        this.errors.push({
            message,
            line: token.line,
            column: token.column,
            offset: token.offset,
            token
        });
    }

    private synchronize(): void {
        this.advance();

        while (!this.isAtEnd()) {
            if (this.previous().type === TokenType.SEMICOLON) return;

            switch (this.peek().type) {
                case TokenType.FN:
                case TokenType.STRUCT:
                case TokenType.ENUM:
                case TokenType.LET:
                case TokenType.CONST:
                case TokenType.IF:
                case TokenType.FOR:
                case TokenType.WHILE:
                case TokenType.RETURN:
                    return;
            }

            this.advance();
        }
    }
} 