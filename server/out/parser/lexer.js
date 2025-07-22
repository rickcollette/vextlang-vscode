"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    // Keywords
    TokenType["FN"] = "fn";
    TokenType["LET"] = "let";
    TokenType["CONST"] = "const";
    TokenType["STRUCT"] = "struct";
    TokenType["ENUM"] = "enum";
    TokenType["IF"] = "if";
    TokenType["ELSE"] = "else";
    TokenType["FOR"] = "for";
    TokenType["WHILE"] = "while";
    TokenType["BREAK"] = "break";
    TokenType["CONTINUE"] = "continue";
    TokenType["RETURN"] = "return";
    TokenType["MATCH"] = "match";
    TokenType["WHERE"] = "where";
    TokenType["ASYNC"] = "async";
    TokenType["AWAIT"] = "await";
    TokenType["TRAIT"] = "trait";
    TokenType["IMPL"] = "impl";
    TokenType["IMPORT"] = "import";
    TokenType["PACKAGE"] = "package";
    TokenType["MOD"] = "mod";
    // Types
    TokenType["INT"] = "int";
    TokenType["FLOAT"] = "float";
    TokenType["BOOL"] = "bool";
    TokenType["STRING"] = "string";
    TokenType["CHAR"] = "char";
    TokenType["VOID"] = "void";
    TokenType["OPTION"] = "Option";
    TokenType["RESULT"] = "Result";
    TokenType["VEC"] = "Vec";
    // Literals
    TokenType["BOOLEAN_LITERAL"] = "boolean_literal";
    TokenType["INTEGER_LITERAL"] = "integer_literal";
    TokenType["FLOAT_LITERAL"] = "float_literal";
    TokenType["STRING_LITERAL"] = "string_literal";
    TokenType["CHAR_LITERAL"] = "char_literal";
    // Identifiers
    TokenType["IDENTIFIER"] = "identifier";
    // Operators
    TokenType["PLUS"] = "+";
    TokenType["MINUS"] = "-";
    TokenType["STAR"] = "*";
    TokenType["SLASH"] = "/";
    TokenType["PERCENT"] = "%";
    TokenType["ASSIGN"] = "=";
    TokenType["PLUS_ASSIGN"] = "+=";
    TokenType["MINUS_ASSIGN"] = "-=";
    TokenType["STAR_ASSIGN"] = "*=";
    TokenType["SLASH_ASSIGN"] = "/=";
    TokenType["PERCENT_ASSIGN"] = "%=";
    // Comparison
    TokenType["EQUAL"] = "==";
    TokenType["NOT_EQUAL"] = "!=";
    TokenType["LESS"] = "<";
    TokenType["LESS_EQUAL"] = "<=";
    TokenType["GREATER"] = ">";
    TokenType["GREATER_EQUAL"] = ">=";
    // Logical
    TokenType["AND"] = "&&";
    TokenType["OR"] = "||";
    TokenType["NOT"] = "!";
    // Delimiters
    TokenType["LEFT_PAREN"] = "(";
    TokenType["RIGHT_PAREN"] = ")";
    TokenType["LEFT_BRACE"] = "{";
    TokenType["RIGHT_BRACE"] = "}";
    TokenType["LEFT_BRACKET"] = "[";
    TokenType["RIGHT_BRACKET"] = "]";
    TokenType["SEMICOLON"] = ";";
    TokenType["COMMA"] = ",";
    TokenType["COLON"] = ":";
    TokenType["DOT"] = ".";
    TokenType["ARROW"] = "->";
    TokenType["DOUBLE_COLON"] = "::";
    TokenType["QUESTION"] = "?";
    // Comments
    TokenType["LINE_COMMENT"] = "line_comment";
    TokenType["BLOCK_COMMENT"] = "block_comment";
    // Special
    TokenType["EOF"] = "eof";
    TokenType["ERROR"] = "error";
})(TokenType || (exports.TokenType = TokenType = {}));
class Lexer {
    constructor(source) {
        this.current = 0;
        this.line = 1;
        this.column = 1;
        this.errors = [];
        this.source = source;
    }
    tokenize() {
        const tokens = [];
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
    nextToken() {
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
    lexLineComment() {
        const start = this.current;
        this.advance(); // consume '/'
        this.advance(); // consume '/'
        while (this.current < this.source.length && this.source[this.current] !== '\n') {
            this.advance();
        }
        const value = this.source.substring(start, this.current);
        return this.createToken(TokenType.LINE_COMMENT, value);
    }
    lexBlockComment() {
        const start = this.current;
        this.advance(); // consume '/'
        this.advance(); // consume '*'
        let depth = 1;
        while (this.current < this.source.length && depth > 0) {
            if (this.source[this.current] === '/' && this.peek(1) === '*') {
                depth++;
                this.advance();
                this.advance();
            }
            else if (this.source[this.current] === '*' && this.peek(1) === '/') {
                depth--;
                this.advance();
                this.advance();
            }
            else {
                this.advance();
            }
        }
        if (depth > 0) {
            this.addError('Unterminated block comment');
        }
        const value = this.source.substring(start, this.current);
        return this.createToken(TokenType.BLOCK_COMMENT, value);
    }
    lexStringLiteral() {
        const start = this.current;
        this.advance(); // consume opening quote
        while (this.current < this.source.length && this.source[this.current] !== '"') {
            if (this.source[this.current] === '\\') {
                this.advance(); // consume backslash
                if (this.current < this.source.length) {
                    this.advance(); // consume escaped character
                }
            }
            else {
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
    lexCharLiteral() {
        const start = this.current;
        this.advance(); // consume opening quote
        if (this.current < this.source.length && this.source[this.current] === '\\') {
            this.advance(); // consume backslash
            if (this.current < this.source.length) {
                this.advance(); // consume escaped character
            }
        }
        else if (this.current < this.source.length) {
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
    lexNumber() {
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
    lexIdentifier() {
        const start = this.current;
        while (this.current < this.source.length && this.isIdentifierPart(this.source[this.current])) {
            this.advance();
        }
        const value = this.source.substring(start, this.current);
        const type = this.getKeywordType(value);
        return this.createToken(type, value);
    }
    lexOperatorOrDelimiter() {
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
        const singleCharTokens = {
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
    getKeywordType(value) {
        const keywords = {
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
    skipWhitespace() {
        while (this.current < this.source.length && this.isWhitespace(this.source[this.current])) {
            this.advance();
        }
    }
    advance() {
        if (this.current < this.source.length) {
            if (this.source[this.current] === '\n') {
                this.line++;
                this.column = 1;
            }
            else {
                this.column++;
            }
            this.current++;
        }
    }
    peek(offset) {
        const index = this.current + offset;
        return index < this.source.length ? this.source[index] : '\0';
    }
    isWhitespace(char) {
        return char === ' ' || char === '\t' || char === '\r' || char === '\n';
    }
    isDigit(char) {
        return char >= '0' && char <= '9';
    }
    isIdentifierStart(char) {
        return (char >= 'a' && char <= 'z') ||
            (char >= 'A' && char <= 'Z') ||
            char === '_';
    }
    isIdentifierPart(char) {
        return this.isIdentifierStart(char) || this.isDigit(char);
    }
    createToken(type, value) {
        return {
            type,
            value,
            line: this.line,
            column: this.column - value.length,
            offset: this.current - value.length
        };
    }
    addError(message) {
        this.errors.push({
            message,
            line: this.line,
            column: this.column,
            offset: this.current
        });
    }
}
exports.Lexer = Lexer;
//# sourceMappingURL=lexer.js.map