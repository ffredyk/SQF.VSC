# SQF Language Support for VS Code

Syntax highlighting, real-time diagnostics, IntelliSense, hover docs, wiki lookup,
snippets, formatting, and build integration for **Arma SQF** and **SQ# (SQF Sharp)**.

> Powered by the [SQ# engine](https://github.com/ffredyk/SQF.NET) — a .NET reimplementation of Arma 3's SQF scripting language.

## Features

| Feature | Description |
|---|---|
| **Syntax highlighting** | Full TextMate grammars — 2,630 Arma commands + SQ# keywords |
| **Real-time diagnostics** | Red wavy underlines as you type — no save needed |
| **IntelliSense autocomplete** | All 2,630 commands + local variables + keywords |
| **Hover documentation** | ~120 commands with signatures and descriptions |
| **Wiki lookup** | `Ctrl+K Ctrl+W` → open `community.bistudio.com/wiki/<command>` |
| **Go to definition** | `Ctrl+Click` on `#include "file.sqf"` to open it |
| **Code snippets** | 25 snippets: `if`, `while`, `for`, `switch`, `try`, `private`, `params`, etc. |
| **Document formatting** | `Shift+Alt+F` — auto-indent based on `{}` blocks |
| **SQ# CLI integration** | Compile, run, lex, parse from command palette |
| **Problem matcher** | Errors appear in Problems panel (`Ctrl+Shift+M`) |
| **Bundled CLI** | Zero-install — self-contained SQ# binaries for win/linux/mac |
| **Preprocessor highlighting** | `#include`, `#define`, `#ifdef` (Arma SQF mode) |
| **Bracket matching** | `{}`, `[]`, `()` auto-close and match |
| **Code folding** | `//region` markers + indentation-based |
| **Status bar toggle** | Click to switch between Arma SQF and SQ# highlighting |
| **Task integration** | `tasks.json` compile and run tasks |

## Language Modes

Both modes auto-detect `.sqf` files and run **SQ# diagnostics** on all of them.
The difference is syntax highlighting:

| Mode | File Association | Highlighting |
|---|---|---|
| **Arma SQF** | `.sqf` (default) | All 2,630 Arma commands + preprocessor |
| **SQ#** | Manual switch via status bar or `Ctrl+Shift+P` | SQ# keywords + concurrency commands |

Click the status bar indicator (`Arma SQF` / `SQ#`) to toggle highlighting mode.
Diagnostics, autocomplete, hover, and all other features work in both modes.

## SQ# CLI Integration

**No setup required** — self-contained SQ# binaries bundled for Windows, Linux, and macOS.

Override: set `sqf.sqsharpCliPath` to a custom SQ# CLI path.

### Commands (`Ctrl+Shift+P`)

| Command | Description |
|---|---|
| `SQ#: Compile current file` | Compile to bytecode |
| `SQ#: Run current file` | Execute script |
| `SQ#: Lex current file` | Token dump |
| `SQ#: Parse current file` | AST dump |
| `SQF: Open Wiki for command at cursor` | Open Arma wiki page |

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K Ctrl+W` | Open wiki for command at cursor |
| `Shift+Alt+F` | Format document |

### Settings

| Setting | Default | Description |
|---|---|---|
| `sqf.sqsharpCliPath` | `""` | Path to SQ# CLI (empty = use bundled binary) |
| `sqf.lintOnSave` | `true` | Run diagnostics on file save |
| `sqf.lintOnChange` | `true` | Run diagnostics as you type (500ms debounce) |

## Snippets

Type prefix + `Tab` to expand:

| Prefix | Output |
|---|---|
| `if` | if-then block |
| `ife` | if-then-else |
| `ifex` | if-exitWith |
| `while` | while-do loop |
| `for` | for-do (C-style) |
| `forf` | for-from-to range |
| `forfs` | for-from-to-step |
| `switch` | switch-do |
| `try` | try-catch |
| `func` | function definition |
| `params` | params declaration |
| `private` | private array |
| `forEach` | forEach loop |
| `spawn` | spawn code block |
| `spawnOn` | spawnOn scheduler |
| `shared` | shared variable (SQ#) |
| `include` | `#include "file.sqf"` |
| `define` | `#define MACRO` |
| `addeh` | addEventHandler |
| + `hint`, `syschat`, `diag`, `format`, `hashmap`, `call` |

## Development

```bash
npm install
npm run compile
npm run generate-grammars   # Regenerate syntax highlighting from reference.txt
npm run publish-cli          # Build SQ# CLI binaries for all platforms
```

Press `F5` to launch extension in debug mode.

## Credits

- SQ# engine: [SQF.NET](https://github.com/ffredyk/SQF.NET)
- Arma command reference: [community.bistudio.com](https://community.bistudio.com/wiki/)
