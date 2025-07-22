export enum TokenType {
    // Keywords
    FN = 'fn',
    LET = 'let',
    CONST = 'const',
    STRUCT = 'struct',
    ENUM = 'enum',
    IF = 'if',
    ELSE = 'else',
    FOR = 'for',
    WHILE = 'while',
    BREAK = 'break',
    CONTINUE = 'continue',
    RETURN = 'return',
    MATCH = 'match',
    WHERE = 'where',
    ASYNC = 'async',
    AWAIT = 'await',
    TRAIT = 'trait',
    IMPL = 'impl',
    IMPORT = 'import',
    PACKAGE = 'package',
    MOD = 'mod',

    // Types
    INT = 'int',
    FLOAT = 'float',
    BOOL = 'bool',
    STRING = 'string',
    CHAR = 'char',
    VOID = 'void',
    OPTION = 'Option',
    RESULT = 'Result',
    VEC = 'Vec',

    // Literals
    BOOLEAN_LITERAL = 'boolean_literal',
    INTEGER_LITERAL = 'integer_literal',
    FLOAT_LITERAL = 'float_literal',
    STRING_LITERAL = 'string_literal',
    CHAR_LITERAL = 'char_literal',

    // Identifiers
    IDENTIFIER = 'identifier',

    // Operators
    PLUS = '+',
    MINUS = '-',
    STAR = '*',
    SLASH = '/',
    PERCENT = '%',
    ASSIGN = '=',
    PLUS_ASSIGN = '+=',
    MINUS_ASSIGN = '-=',
    STAR_ASSIGN = '*=',
    SLASH_ASSIGN = '/=',
    PERCENT_ASSIGN = '%=',

    // Comparison
    EQUAL = '==',
    NOT_EQUAL = '!=',
    LESS = '<',
    LESS_EQUAL = '<=',
    GREATER = '>',
    GREATER_EQUAL = '>=',

    // Logical
    AND = '&&',
    OR = '||',
    NOT = '!',

    // Delimiters
    LEFT_PAREN = '(',
    RIGHT_PAREN = ')',
    LEFT_BRACE = '{',
    RIGHT_BRACE = '}',
    LEFT_BRACKET = '[',
    RIGHT_BRACKET = ']',
    SEMICOLON = ';',
    COMMA = ',',
    COLON = ':',
    DOT = '.',
    ARROW = '->',
    DOUBLE_COLON = '::',
    QUESTION = '?',

    // Comments
    LINE_COMMENT = 'line_comment',
    BLOCK_COMMENT = 'block_comment',

    // Special
    EOF = 'eof',
    ERROR = 'error'
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
    offset: number;
}

export interface LexerError {
    message: string;
    line: number;
    column: number;
    offset: number;
}

export class Lexer {
    private source: string;
    private current: number = 0;
    private line: number = 1;
    private column: number = 1;
    private errors: LexerError[] = [];

    constructor(source: string) {
        this.source = source;
    }

    tokenize(): { tokens: Token[]; errors: LexerError[] } {
        const tokens: Token[] = [];

        while (this.current < this.source.length) {
            const token = this.nextToken();
            if (token.type !== TokenType.ERROR) {
                tokens.push(token);
            }

            if (token.type === TokenType.EOF) {
                break;
            }
        }

        return { tokens, errors: this.errors };
    }

    private nextToken(): Token {
        this.skipWhitespace();

        if (this.current >= this.source.length) {
            return this.createToken(TokenType.EOF, '');
        }

        const char = this.source[this.current];
        const startLine = this.line;
        const startColumn = this.column;
        const startOffset = this.current;

        // Comments
        if (char === '/' && this.peek(1) === '/') {
            return this.lexLineComment();
        }

        if (char === '/' && this.peek(1) === '*') {
            return this.lexBlockComment();
        }

        // String literals
        if (char === '"') {
            return this.lexStringLiteral();
        }

        if (char === "'") {
            return this.lexCharLiteral();
        }

        // Numbers
        if (this.isDigit(char)) {
            return this.lexNumber();
        }

        // Identifiers and keywords
        if (this.isIdentifierStart(char)) {
            return this.lexIdentifier();
        }

        // Operators and delimiters
        return this.lexOperatorOrDelimiter();
    }

    private lexLineComment(): Token {
        const start = this.current;
        this.advance(); // consume '/'
        this.advance(); // consume '/'

        while (this.current < this.source.length && this.source[this.current] !== '\n') {
            this.advance();
        }

        const value = this.source.substring(start, this.current);
        return this.createToken(TokenType.LINE_COMMENT, value);
    }

    private lexBlockComment(): Token {
        const start = this.current;
        this.advance(); // consume '/'
        this.advance(); // consume '*'

        let depth = 1;
        while (this.current < this.source.length && depth > 0) {
            if (this.source[this.current] === '/' && this.peek(1) === '*') {
                depth++;
                this.advance();
                this.advance();
            } else if (this.source[this.current] === '*' && this.peek(1) === '/') {
                depth--;
                this.advance();
                this.advance();
            } else {
                this.advance();
            }
        }

        if (depth > 0) {
            this.addError('Unterminated block comment');
        }

        const value = this.source.substring(start, this.current);
        return this.createToken(TokenType.BLOCK_COMMENT, value);
    }

    private lexStringLiteral(): Token {
        const start = this.current;
        this.advance(); // consume opening quote

        while (this.current < this.source.length && this.source[this.current] !== '"') {
            if (this.source[this.current] === '\\') {
                this.advance(); // consume backslash
                if (this.current < this.source.length) {
                    this.advance(); // consume escaped character
                }
            } else {
                this.advance();
            }
        }

        if (this.current >= this.source.length) {
            this.addError('Unterminated string literal');
            const value = this.source.substring(start);
            return this.createToken(TokenType.ERROR, value);
        }

        this.advance(); // consume closing quote
        const value = this.source.substring(start, this.current);
        return this.createToken(TokenType.STRING_LITERAL, value);
    }

    private lexCharLiteral(): Token {
        const start = this.current;
        this.advance(); // consume opening quote

        if (this.current < this.source.length && this.source[this.current] === '\\') {
            this.advance(); // consume backslash
            if (this.current < this.source.length) {
                this.advance(); // consume escaped character
            }
        } else if (this.current < this.source.length) {
            this.advance(); // consume character
        }

        if (this.current >= this.source.length || this.source[this.current] !== "'") {
            this.addError('Unterminated character literal');
            const value = this.source.substring(start);
            return this.createToken(TokenType.ERROR, value);
        }

        this.advance(); // consume closing quote
        const value = this.source.substring(start, this.current);
        return this.createToken(TokenType.CHAR_LITERAL, value);
    }

    private lexNumber(): Token {
        const start = this.current;
        let isFloat = false;

        // Integer part
        while (this.current < this.source.length && this.isDigit(this.source[this.current])) {
            this.advance();
        }

        // Fractional part
        if (this.current < this.source.length && this.source[this.current] === '.') {
            isFloat = true;
            this.advance();

            while (this.current < this.source.length && this.isDigit(this.source[this.current])) {
                this.advance();
            }
        }

        // Exponent part
        if (this.current < this.source.length && (this.source[this.current] === 'e' || this.source[this.current] === 'E')) {
            isFloat = true;
            this.advance();

            if (this.current < this.source.length && (this.source[this.current] === '+' || this.source[this.current] === '-')) {
                this.advance();
            }

            while (this.current < this.source.length && this.isDigit(this.source[this.current])) {
                this.advance();
            }
        }

        const value = this.source.substring(start, this.current);
        const type = isFloat ? TokenType.FLOAT_LITERAL : TokenType.INTEGER_LITERAL;
        return this.createToken(type, value);
    }

    private lexIdentifier(): Token {
        const start = this.current;

        while (this.current < this.source.length && this.isIdentifierPart(this.source[this.current])) {
            this.advance();
        }

        const value = this.source.substring(start, this.current);
        const type = this.getKeywordType(value);
        return this.createToken(type, value);
    }

    private lexOperatorOrDelimiter(): Token {
        const char = this.source[this.current];
        const nextChar = this.peek(1);
        const nextNextChar = this.peek(2);

        // Three-character operators
        if (char === '<' && nextChar === '<' && nextNextChar === '=') {
            this.advance();
            this.advance();
            this.advance();
            return this.createToken(TokenType.ERROR, '<<='); // Not supported in VextLang
        }

        // Two-character operators
        if (char === '=' && nextChar === '=') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.EQUAL, '==');
        }

        if (char === '!' && nextChar === '=') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.NOT_EQUAL, '!=');
        }

        if (char === '<' && nextChar === '=') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.LESS_EQUAL, '<=');
        }

        if (char === '>' && nextChar === '=') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.GREATER_EQUAL, '>=');
        }

        if (char === '&' && nextChar === '&') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.AND, '&&');
        }

        if (char === '|' && nextChar === '|') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.OR, '||');
        }

        if (char === '+' && nextChar === '=') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.PLUS_ASSIGN, '+=');
        }

        if (char === '-' && nextChar === '=') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.MINUS_ASSIGN, '-=');
        }

        if (char === '*' && nextChar === '=') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.STAR_ASSIGN, '*=');
        }

        if (char === '/' && nextChar === '=') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.SLASH_ASSIGN, '/=');
        }

        if (char === '%' && nextChar === '=') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.PERCENT_ASSIGN, '%=');
        }

        if (char === '-' && nextChar === '>') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.ARROW, '->');
        }

        if (char === ':' && nextChar === ':') {
            this.advance();
            this.advance();
            return this.createToken(TokenType.DOUBLE_COLON, '::');
        }

        // Single-character operators and delimiters
        const singleCharTokens: { [key: string]: TokenType } = {
            '+': TokenType.PLUS,
            '-': TokenType.MINUS,
            '*': TokenType.STAR,
            '/': TokenType.SLASH,
            '%': TokenType.PERCENT,
            '=': TokenType.ASSIGN,
            '<': TokenType.LESS,
            '>': TokenType.GREATER,
            '!': TokenType.NOT,
            '(': TokenType.LEFT_PAREN,
            ')': TokenType.RIGHT_PAREN,
            '{': TokenType.LEFT_BRACE,
            '}': TokenType.RIGHT_BRACE,
            '[': TokenType.LEFT_BRACKET,
            ']': TokenType.RIGHT_BRACKET,
            ';': TokenType.SEMICOLON,
            ',': TokenType.COMMA,
            ':': TokenType.COLON,
            '.': TokenType.DOT,
            '?': TokenType.QUESTION
        };

        if (char in singleCharTokens) {
            this.advance();
            return this.createToken(singleCharTokens[char], char);
        }

        // Unknown character
        this.addError(`Unexpected character: ${char}`);
        this.advance();
        return this.createToken(TokenType.ERROR, char);
    }

    private getKeywordType(value: string): TokenType {
        const keywords: { [key: string]: TokenType } = {
            'fn': TokenType.FN,
            'let': TokenType.LET,
            'const': TokenType.CONST,
            'struct': TokenType.STRUCT,
            'enum': TokenType.ENUM,
            'if': TokenType.IF,
            'else': TokenType.ELSE,
            'for': TokenType.FOR,
            'while': TokenType.WHILE,
            'break': TokenType.BREAK,
            'continue': TokenType.CONTINUE,
            'return': TokenType.RETURN,
            'match': TokenType.MATCH,
            'where': TokenType.WHERE,
            'async': TokenType.ASYNC,
            'await': TokenType.AWAIT,
            'trait': TokenType.TRAIT,
            'impl': TokenType.IMPL,
            'import': TokenType.IMPORT,
            'package': TokenType.PACKAGE,
            'mod': TokenType.MOD,
            'int': TokenType.INT,
            'float': TokenType.FLOAT,
            'bool': TokenType.BOOL,
            'string': TokenType.STRING,
            'char': TokenType.CHAR,
            'void': TokenType.VOID,
            'Option': TokenType.OPTION,
            'Result': TokenType.RESULT,
            'Vec': TokenType.VEC,
            'true': TokenType.BOOLEAN_LITERAL,
            'false': TokenType.BOOLEAN_LITERAL
        };

        return keywords[value] || TokenType.IDENTIFIER;
    }

    private skipWhitespace(): void {
        while (this.current < this.source.length && this.isWhitespace(this.source[this.current])) {
            this.advance();
        }
    }

    private advance(): void {
        if (this.current < this.source.length) {
            if (this.source[this.current] === '\n') {
                this.line++;
                this.column = 1;
            } else {
                this.column++;
            }
            this.current++;
        }
    }

    private peek(offset: number): string {
        const index = this.current + offset;
        return index < this.source.length ? this.source[index] : '\0';
    }

    private isWhitespace(char: string): boolean {
        return char === ' ' || char === '\t' || char === '\r' || char === '\n';
    }

    private isDigit(char: string): boolean {
        return char >= '0' && char <= '9';
    }

    private isIdentifierStart(char: string): boolean {
        return (char >= 'a' && char <= 'z') ||
            (char >= 'A' && char <= 'Z') ||
            char === '_';
    }

    private isIdentifierPart(char: string): boolean {
        return this.isIdentifierStart(char) || this.isDigit(char);
    }

    private createToken(type: TokenType, value: string): Token {
        return {
            type,
            value,
            line: this.line,
            column: this.column - value.length,
            offset: this.current - value.length
        };
    }

    private addError(message: string): void {
        this.errors.push({
            message,
            line: this.line,
            column: this.column,
            offset: this.current
        });
    }
} 