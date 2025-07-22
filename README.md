# VextLang

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://github.com/rickcollette/vext-lang-vscode/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-blue.svg)](https://code.visualstudio.com/)

**Official VS Code extension for the VextLang programming language**

This extension provides comprehensive language support for VextLang, including syntax highlighting, IntelliSense, debugging, formatting, and more.

## Features

### ✨ Language Support
- **Syntax Highlighting** - Full TextMate grammar for VextLang syntax
- **Language Server Protocol (LSP)** - Complete IntelliSense and code intelligence
- **Debug Adapter Protocol (DAP)** - Integrated debugging support
- **Code Formatting** - Automatic formatting with 4-space indentation
- **Code Snippets** - Templates for common VextLang constructs
- **Bracket Matching** - Automatic bracket pairing and auto-closing

### 🧠 IntelliSense
- **Code Completion** - Context-aware suggestions for keywords, types, and symbols
- **Hover Information** - Detailed documentation and type information
- **Go to Definition** - Navigate to symbol definitions
- **Find References** - Locate all usages of symbols
- **Rename** - Refactor symbol names across the workspace
- **Signature Help** - Function parameter assistance
- **Document Symbols** - File structure outline
- **Workspace Symbols** - Global symbol search
- **Semantic Tokens** - Rich syntax highlighting
- **Call Hierarchy** - Function call analysis

### 🐛 Debugging
- **Breakpoints** - Line and exception breakpoints
- **Variable Inspection** - View and modify local/global variables
- **Call Stack** - Navigate through function calls
- **Step Through** - Step in, over, and out of code
- **Watch Expressions** - Evaluate expressions during debugging
- **Debug Console** - Interactive debugging console

### 🎨 Formatting
- **Auto-format on Save** - Automatic code formatting
- **Manual Formatting** - Format document command
- **4-Space Indentation** - Consistent indentation rules
- **Brace Placement** - Proper brace and operator spacing

## Installation

### From VSIX (Recommended)
1. Download the latest `.vsix` file from [GitHub Releases](https://github.com/rickcollette/vext-lang-vscode/releases)
2. Open VS Code
3. Go to Extensions (`Ctrl+Shift+X`)
4. Click the "..." menu and select "Install from VSIX..."
5. Select the downloaded `.vsix` file

### From Source
```bash
git clone https://github.com/rickcollette/vext-lang-vscode.git
cd vext-lang-vscode
npm install
npm run compile
npx vsce package
# Install the generated .vsix file
```

## Quick Start

1. **Create a VextLang file** - Create a new file with `.vex` extension
2. **Start coding** - Enjoy syntax highlighting and IntelliSense
3. **Use snippets** - Type `fn` and press `Tab` for function template
4. **Format code** - Use `Shift+Alt+F` to format your code
5. **Debug** - Set breakpoints and press `F5` to debug

## Code Snippets

| Snippet | Description |
|---------|-------------|
| `fn` | Function declaration |
| `struct` | Struct declaration |
| `enum` | Enum declaration |
| `trait` | Trait declaration |
| `impl` | Implementation block |
| `if` | If statement |
| `ifelse` | If-else statement |
| `for` | For loop |
| `while` | While loop |
| `match` | Match expression |
| `let` | Let declaration |
| `const` | Const declaration |
| `import` | Import statement |
| `asyncfn` | Async function |

## Configuration

### Extension Settings

```json
{
    "vextlang.indentSize": 4,
    "vextlang.formatOnSave": true,
    "vextlang.trace.server": "off"
}
```

### Language-Specific Settings

```json
{
    "[vex]": {
        "editor.tabSize": 4,
        "editor.insertSpaces": true,
        "editor.detectIndentation": false,
        "editor.formatOnSave": true,
        "editor.formatOnPaste": true
    }
}
```

## Debugging

### Launch Configuration

Create `.vscode/launch.json`:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "vextlang",
            "request": "launch",
            "name": "Run VextLang Program",
            "program": "${file}",
            "args": [],
            "cwd": "${workspaceFolder}",
            "console": "integratedTerminal"
        }
    ]
}
```

### Debugging Steps
1. Set breakpoints by clicking in the gutter
2. Press `F5` to start debugging
3. Use debug toolbar to step through code
4. Inspect variables in the Debug panel

## Language Features

### VextLang Syntax

```vex
// Comments
// Single line comment
/* Multi-line comment */

// Variables and constants
let x: int = 42;
const PI: float = 3.14159;

// Functions
fn add(a: int, b: int) -> int {
    return a + b;
}

// Structs
struct Point {
    x: float,
    y: float,
}

// Enums
enum Status {
    Active,
    Inactive,
    Pending,
}

// Traits
trait Printable {
    fn print(self) -> void;
}

// Implementations
impl Printable for Point {
    fn print(self) -> void {
        println(format!("Point({}, {})", self.x, self.y));
    }
}

// Control flow
if x > 0 {
    println("positive");
} else {
    println("non-positive");
}

// Loops
for i in 0..10 {
    println(to_string(i));
}

// Pattern matching
match status {
    Status::Active => println("active"),
    Status::Inactive => println("inactive"),
    Status::Pending => println("pending"),
}
```

### Standard Library

The extension includes comprehensive standard library support:

- **Primitive Types**: `int`, `float`, `bool`, `string`, `char`
- **Generic Types**: `Option<T>`, `Result<T, E>`, `Vec<T>`
- **I/O Functions**: `print`, `println`, `read_line`
- **Collection Functions**: `len`, `push`, `pop`, `get`, `set`
- **String Functions**: `split`, `join`, `trim`, `to_lowercase`
- **Math Functions**: `min`, `max`, `abs`, `sqrt`, `pow`
- **Utility Functions**: `parse_int`, `to_string`, `random`

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Language server not starting | Check TypeScript installation: `npm install -g typescript` |
| Syntax highlighting not working | Ensure files have `.vex` extension |
| Debugging not working | Verify `vextc` compiler is in PATH |
| Formatting issues | Check `vextlang.indentSize` setting |

### Enable Debug Logging

```json
{
    "vextlang.trace.server": "verbose"
}
```

View logs in Output panel under "VextLang Language Server".

## Requirements

- **VS Code**: 1.74.0 or higher
- **Node.js**: 16.x or higher (for language server)
- **VextLang Compiler**: `vextc` (for debugging)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Development

### Project Structure

```
vextlang-vscode/
├── client/                 # VS Code extension host
│   ├── src/extension.ts    # Main extension entry point
│   ├── syntaxes/           # TextMate grammar
│   ├── snippets/           # Code snippets
│   └── language-configuration.json
├── server/                 # Language Server (LSP)
│   ├── src/
│   │   ├── server.ts       # LSP server
│   │   ├── parser/         # VextLang parser
│   │   └── semantic/       # Semantic analysis
│   └── package.json
├── debug/                  # Debug Adapter (DAP)
│   ├── src/adapter.ts      # Debug adapter
│   └── package.json
└── package.json            # Extension manifest
```

### Building

```bash
# Install dependencies
npm install

# Build extension
npm run compile

# Package extension
npx vsce package

# Watch for changes
npm run watch
```

## Release Process

This extension uses automated releases via GitHub Actions:

- **Patch releases**: Bug fixes (`npm run release:patch`)
- **Minor releases**: New features (`npm run release:minor`)
- **Major releases**: Breaking changes (`npm run release:major`)

See [RELEASE.md](RELEASE.md) for detailed release instructions.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/rickcollette/vext-lang-vscode/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rickcollette/vext-lang-vscode/discussions)
- **Documentation**: [VextLang Documentation](https://vextlang.org)

---

**Made with ❤️ by the VextLang Team** 