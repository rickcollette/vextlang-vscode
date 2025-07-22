import { SymbolTable, Symbol } from './symbolTable';
import { CompletionItemKind } from 'vscode-languageserver';

export class StdlibLoader {
    loadStdlib(symbolTable: SymbolTable): void {
        // Add primitive types
        const primitiveTypes = ['int', 'float', 'bool', 'string', 'char'];
        for (const type of primitiveTypes) {
            symbolTable.addGlobalSymbol({
                name: type,
                kind: CompletionItemKind.TypeParameter,
                uri: 'stdlib',
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                detail: `Primitive type: ${type}`,
                documentation: `The ${type} primitive type in VextLang.`
            });
        }

        // Add generic types
        const genericTypes = [
            { name: 'Option', description: 'Represents an optional value that may or may not be present.' },
            { name: 'Result', description: 'Represents a value that is either a success or an error.' },
            { name: 'Vec', description: 'A growable array type.' }
        ];

        for (const type of genericTypes) {
            symbolTable.addGlobalSymbol({
                name: type.name,
                kind: CompletionItemKind.TypeParameter,
                uri: 'stdlib',
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                detail: `Generic type: ${type.name}`,
                documentation: type.description
            });
        }

        // Add common functions
        const functions = [
            {
                name: 'print',
                parameters: ['message: string'],
                returnType: 'void',
                description: 'Prints a message to the console.'
            },
            {
                name: 'println',
                parameters: ['message: string'],
                returnType: 'void',
                description: 'Prints a message to the console with a newline.'
            },
            {
                name: 'len',
                parameters: ['collection: Vec<T>'],
                returnType: 'int',
                description: 'Returns the length of a collection.'
            },
            {
                name: 'push',
                parameters: ['collection: Vec<T>', 'item: T'],
                returnType: 'void',
                description: 'Adds an item to the end of a collection.'
            },
            {
                name: 'pop',
                parameters: ['collection: Vec<T>'],
                returnType: 'Option<T>',
                description: 'Removes and returns the last item from a collection.'
            },
            {
                name: 'get',
                parameters: ['collection: Vec<T>', 'index: int'],
                returnType: 'Option<T>',
                description: 'Returns the item at the specified index.'
            },
            {
                name: 'set',
                parameters: ['collection: Vec<T>', 'index: int', 'item: T'],
                returnType: 'bool',
                description: 'Sets the item at the specified index.'
            },
            {
                name: 'contains',
                parameters: ['collection: Vec<T>', 'item: T'],
                returnType: 'bool',
                description: 'Checks if a collection contains an item.'
            },
            {
                name: 'clear',
                parameters: ['collection: Vec<T>'],
                returnType: 'void',
                description: 'Removes all items from a collection.'
            },
            {
                name: 'is_empty',
                parameters: ['collection: Vec<T>'],
                returnType: 'bool',
                description: 'Checks if a collection is empty.'
            },
            {
                name: 'parse_int',
                parameters: ['str: string'],
                returnType: 'Option<int>',
                description: 'Parses a string to an integer.'
            },
            {
                name: 'parse_float',
                parameters: ['str: string'],
                returnType: 'Option<float>',
                description: 'Parses a string to a float.'
            },
            {
                name: 'to_string',
                parameters: ['value: T'],
                returnType: 'string',
                description: 'Converts a value to a string.'
            },
            {
                name: 'min',
                parameters: ['a: T', 'b: T'],
                returnType: 'T',
                description: 'Returns the minimum of two values.'
            },
            {
                name: 'max',
                parameters: ['a: T', 'b: T'],
                returnType: 'T',
                description: 'Returns the maximum of two values.'
            },
            {
                name: 'abs',
                parameters: ['value: float'],
                returnType: 'float',
                description: 'Returns the absolute value of a number.'
            },
            {
                name: 'sqrt',
                parameters: ['value: float'],
                returnType: 'float',
                description: 'Returns the square root of a number.'
            },
            {
                name: 'pow',
                parameters: ['base: float', 'exponent: float'],
                returnType: 'float',
                description: 'Returns the base raised to the power of the exponent.'
            },
            {
                name: 'sin',
                parameters: ['angle: float'],
                returnType: 'float',
                description: 'Returns the sine of an angle in radians.'
            },
            {
                name: 'cos',
                parameters: ['angle: float'],
                returnType: 'float',
                description: 'Returns the cosine of an angle in radians.'
            },
            {
                name: 'tan',
                parameters: ['angle: float'],
                returnType: 'float',
                description: 'Returns the tangent of an angle in radians.'
            },
            {
                name: 'random',
                parameters: ['min: int', 'max: int'],
                returnType: 'int',
                description: 'Returns a random integer between min and max (inclusive).'
            },
            {
                name: 'random_float',
                parameters: ['min: float', 'max: float'],
                returnType: 'float',
                description: 'Returns a random float between min and max.'
            },
            {
                name: 'sleep',
                parameters: ['milliseconds: int'],
                returnType: 'void',
                description: 'Pauses execution for the specified number of milliseconds.'
            },
            {
                name: 'time',
                parameters: [],
                returnType: 'int',
                description: 'Returns the current time in milliseconds since the epoch.'
            },
            {
                name: 'read_line',
                parameters: [],
                returnType: 'Option<string>',
                description: 'Reads a line from standard input.'
            },
            {
                name: 'read_file',
                parameters: ['path: string'],
                returnType: 'Option<string>',
                description: 'Reads the contents of a file.'
            },
            {
                name: 'write_file',
                parameters: ['path: string', 'content: string'],
                returnType: 'bool',
                description: 'Writes content to a file.'
            },
            {
                name: 'file_exists',
                parameters: ['path: string'],
                returnType: 'bool',
                description: 'Checks if a file exists.'
            },
            {
                name: 'delete_file',
                parameters: ['path: string'],
                returnType: 'bool',
                description: 'Deletes a file.'
            },
            {
                name: 'create_dir',
                parameters: ['path: string'],
                returnType: 'bool',
                description: 'Creates a directory.'
            },
            {
                name: 'list_dir',
                parameters: ['path: string'],
                returnType: 'Option<Vec<string>>',
                description: 'Lists the contents of a directory.'
            },
            {
                name: 'split',
                parameters: ['str: string', 'delimiter: string'],
                returnType: 'Vec<string>',
                description: 'Splits a string by a delimiter.'
            },
            {
                name: 'join',
                parameters: ['strings: Vec<string>', 'delimiter: string'],
                returnType: 'string',
                description: 'Joins strings with a delimiter.'
            },
            {
                name: 'trim',
                parameters: ['str: string'],
                returnType: 'string',
                description: 'Removes whitespace from the beginning and end of a string.'
            },
            {
                name: 'to_lowercase',
                parameters: ['str: string'],
                returnType: 'string',
                description: 'Converts a string to lowercase.'
            },
            {
                name: 'to_uppercase',
                parameters: ['str: string'],
                returnType: 'string',
                description: 'Converts a string to uppercase.'
            },
            {
                name: 'starts_with',
                parameters: ['str: string', 'prefix: string'],
                returnType: 'bool',
                description: 'Checks if a string starts with a prefix.'
            },
            {
                name: 'ends_with',
                parameters: ['str: string', 'suffix: string'],
                returnType: 'bool',
                description: 'Checks if a string ends with a suffix.'
            },
            {
                name: 'contains_str',
                parameters: ['str: string', 'substr: string'],
                returnType: 'bool',
                description: 'Checks if a string contains a substring.'
            },
            {
                name: 'replace',
                parameters: ['str: string', 'old: string', 'new: string'],
                returnType: 'string',
                description: 'Replaces all occurrences of old with new in a string.'
            },
            {
                name: 'substring',
                parameters: ['str: string', 'start: int', 'end: int'],
                returnType: 'string',
                description: 'Returns a substring from start to end.'
            }
        ];

        for (const func of functions) {
            symbolTable.addGlobalSymbol({
                name: func.name,
                kind: CompletionItemKind.Function,
                uri: 'stdlib',
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                detail: `${func.name}(${func.parameters.join(', ')}) -> ${func.returnType}`,
                documentation: func.description,
                parameters: func.parameters,
                returnType: func.returnType
            });
        }

        // Add constants
        const constants = [
            { name: 'PI', value: '3.14159265359', description: 'The mathematical constant π.' },
            { name: 'E', value: '2.71828182846', description: 'The mathematical constant e.' },
            { name: 'MAX_INT', value: '2147483647', description: 'The maximum value for a 32-bit integer.' },
            { name: 'MIN_INT', value: '-2147483648', description: 'The minimum value for a 32-bit integer.' },
            { name: 'MAX_FLOAT', value: '3.402823e+38', description: 'The maximum value for a 32-bit float.' },
            { name: 'MIN_FLOAT', value: '1.175494e-38', description: 'The minimum value for a 32-bit float.' }
        ];

        for (const constant of constants) {
            symbolTable.addGlobalSymbol({
                name: constant.name,
                kind: CompletionItemKind.Constant,
                uri: 'stdlib',
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                detail: `Constant: ${constant.name} = ${constant.value}`,
                documentation: constant.description
            });
        }
    }
} 