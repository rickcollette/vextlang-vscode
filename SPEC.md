Below is a detailed spec for your VS Code “VextLang” extension, with 4‑space formatting, full TextMate grammar, and a comprehensive LSP feature set—ready to hand off to your developer team.

---

## 1. Project Structure

```
vscode-vextlang/
├── client/                      # VS Code extension host (TypeScript)
│   ├── src/
│   │   └── extension.ts         # activation, LSP/DAP client bootstrap
│   ├── language-configuration.json
│   ├── syntaxes/
│   │   └── vextlang.tmLanguage.json
│   ├── snippets/
│   │   └── vextlang.json
│   └── package.json
├── server/                      # Language Server (LSP)
│   ├── cmd/                     # entry‑point(s)
│   ├── internal/
│   │   ├── parser/              # your .vex grammar + AST
│   │   ├── semantic/            # symbol tables, type checking
│   │   └── lsp/                 # handlers for initialize, hover, etc.
│   └── go.mod (or Cargo.toml)
└── debug/                       # Debug Adapter (DAP)
    ├── src/
    │   └── adapter.ts
    └── package.json
```

---

## 2. Formatting

* **Indentation**: 4 spaces
* **Settings** (in `package.json` → `contributes.configuration`):

  ```jsonc
  "vextlang.indentSize": {
    "type": "number",
    "default": 4,
    "description": "Number of spaces per indent in VextLang files."
  },
  "editor.tabSize": {
    "scope": ["source.vex"],
    "value": 4
  },
  "editor.insertSpaces": {
    "scope": ["source.vex"],
    "value": true
  },
  "vextlang.formatOnSave": {
    "type": "boolean",
    "default": true,
    "description": "Auto‑format VextLang on save."
  }
  ```
* **Formatter integration**:

  * Expose a command `"vextlang.format"` that runs `vextc --format --indent-size=4`
  * Register a `DocumentFormattingEditProvider` in the client to call it

---

## 3. Full Syntax Highlighting

Provide a **TextMate grammar** covering all VextLang constructs:

* **Comments**

  * `//…` (single line)
  * `/* … */` (multi‑line)

* **Keywords**
  `fn, let, const, struct, enum, import, package, if, else, for, while, break, continue, return, match, where, async, await, trait, impl`

* **Types & Primitives**

  * Primitive: `int, float, bool, string, char`
  * User types: identifiers following `struct`/`enum` declarations
  * Built‑in generics: `Option`, `Result`, `Vec`

* **Literals**

  * Strings: `"…"` with escape sequences
  * Characters: `'.'`
  * Numbers: integer (`\b\d+\b`), float (`\b\d+\.\d+\b`)
  * Boolean: `true`, `false`

* **Operators & Punctuation**

  * Arithmetic: `+ - * / %`
  * Comparison: `== != < <= > >=`
  * Logical: `&& \|\| !`
  * Assignment: `=`, compound `+=`, `-=`, etc.
  * Punctuation: `, ; : . -> ::`
  * Brackets: `() [] {}`

* **Annotations & Attributes**

  * `@inline`, `@deprecated`, etc.

* **Generics & Lifetimes**

  * Angle brackets: `<T, U>`
  * Lifetime-like syntax: `<'a>`

* **Pattern Matching**

  * `match … { … }`
  * Guards: `if … =>`

* **Module Paths**

  * `foo::bar::Baz`

* **Regex (if supported)**

  * `/…/`

Your `.tmLanguage.json` should assign the appropriate `scopeName` for each (e.g. `keyword.control.vex`, `entity.name.type.vex`, `string.quoted.double.vex`, etc.)—mirroring the Go grammar.

---

## 4. Language Server (LSP) Features

Implement the following LSP capabilities:

| Feature               | LSP Method                                     | Notes                                                                         |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| **Initialization**    | `initialize`                                   | Advertise vextlang, workspace folders, capabilities                           |
| **Text Sync**         | `textDocument/didChange`                       | Full or incremental                                                           |
| **Diagnostics**       | `textDocument/publishDiagnostics`              | Parse + semantic type errors                                                  |
| **Completion**        | `textDocument/completion`                      | - Trigger on `.`, `::`, `(`, `<`<br>- Include keywords, stdlib, local symbols |
| **Hover**             | `textDocument/hover`                           | Show docs + type signatures                                                   |
| **Signature Help**    | `textDocument/signatureHelp`                   | On `(` after fn call                                                          |
| **Go‑to Definition**  | `textDocument/definition`                      | Jump to decl in same or other file                                            |
| **Find References**   | `textDocument/references`                      | All symbol usages                                                             |
| **Rename**            | `textDocument/rename`                          | Update all references                                                         |
| **Document Symbols**  | `textDocument/documentSymbol`                  | Outline view                                                                  |
| **Workspace Symbols** | `workspace/symbol`                             | Global symbol search                                                          |
| **Formatting**        | `textDocument/formatting`                      | 4‑space indent, spacing rules                                                 |
| **Folding Ranges**    | `textDocument/foldingRange`                    | `struct`, `fn`, comment blocks                                                |
| **Code Actions**      | `textDocument/codeAction`                      | Quick‑fix missing imports, semicolons                                         |
| **Semantic Tokens**   | `textDocument/semanticTokens`                  | Rich highlight, differentiate local vs. global                                |
| **Call Hierarchy**    | `callHierarchy/incomingCalls`, `outgoingCalls` | Optional for advanced IDE features                                            |

> **Stdlib Preload**: on server start, load all symbols from your `output_stdlib.txt` into the global index so completions, hovers, and go‑to work without requiring an import.

---

## 5. Debug Adapter (DAP) Features

* **Launch Config** (`.vscode/launch.json`):

  ```json
  {
    "configurations": [
      {
        "type": "vextlang",
        "request": "launch",
        "name": "Run VextLang Program",
        "program": "${file}"
      }
    ]
  }
  ```
* **DAP Methods**:

  * `initialize`, `launch`, `setBreakpoints`, `configurationDone`
  * `threads`, `stackTrace`, `scopes`, `variables`, `continue`, `next`, `stepIn`, `stepOut`, `pause`
* **Breakpoints**: support line and exception breakpoints
* **Variable Inspection**: show locals, arguments, and globals

You can build atop the [vscode-debugadapter](https://github.com/microsoft/vscode-debugadapter-node) library; spawn `vextc --debug …` and translate its JSON over to the IDE.

---

## 6. Editor Integrations

* **Code Snippets** (4‑space indent):

  ```jsonc
  {
    "Function": {
      "prefix": "fn",
      "body": [
        "fn ${1:name}(${2:args}) -> ${3:Type} {",
        "    $0",
        "}"
      ],
      "description": "Function declaration"
    },
    "Struct": {
      "prefix": "struct",
      "body": [
        "struct ${1:Name} {",
        "    ${2:field}: ${3:Type},",
        "}"
      ],
      "description": "Struct declaration"
    }
  }
  ```
* **Bracket Matching & Auto‑Closing**: via `language-configuration.json`
* **On‑Enter Rules**: auto‑indent after `{` and reduce on `}`

```json
{
  "indentationRules": {
    "increaseIndentPattern": "^.*(\\b(fn|struct|enum|if|for|while)\\b.*\\{[^}]*$)",
    "decreaseIndentPattern": "^\\s*\\}"
  },
  "onEnterRules": [
    {
      "beforeText": "^.*\\{[^}]*$",
      "action": { "indentAction": "indent" }
    },
    {
      "beforeText": "^\\s*\\}",
      "action": { "indentAction": "outdent" }
    }
  ]
}
```

---

## 7. Configuration & Settings

```jsonc
"contributes": {
  "configuration": {
    "title": "VextLang",
    "properties": {
      "vextlang.indentSize": { "type": "number", "default": 4 },
      "vextlang.formatOnSave": { "type": "boolean", "default": true },
      "vextlang.trace.server": {
        "type": "string",
        "enum": ["off","messages","verbose"],
        "default": "off"
      }
    }
  },
  "commands": [
    {
      "command": "vextlang.format",
      "title": "Format Document (VextLang)"
    }
  ]
}
```

---

## 8. Testing & CI

* **Unit tests** for your LSP server (e.g. using Mocha/Go tests)
* **Integration tests** against sample `.vex` projects
* **VS Code Extension Tests** via the [vscode-test](https://github.com/microsoft/vscode-test) harness

---

### Deliverables for Your Developer

1. **Extension scaffold** (client, server, debug folders)
2. **TextMate grammar** covering all language constructs
3. **LSP server** implementing every feature above
4. **Debug Adapter** for breakpoints & stepping
5. **Formatter** respecting 4‑space indents
6. **Snippets & config** files for VS Code contributions
7. **Documentation**: README with install, usage, and settings

With this spec in hand, your team can build a VS Code extension that’s every bit as polished—and as powerful—as the Go plugin.

