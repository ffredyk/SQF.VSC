import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SqfCompletionProvider } from './completions';
import { SqfHoverProvider } from './hover';
import { SqfDefinitionProvider } from './definition';
import { SqfFormattingProvider, SqfRangeFormattingProvider } from './formatting';

// ── Module-level context (set during activation) ──────────────────────

let _ctx: vscode.ExtensionContext | null = null;

function isSqfLanguage(langId: string): boolean {
    return langId === 'sqf' || langId === 'sqsharp';
}

function getPlatformTarget(): string {
    const plat = os.platform();
    const arch = os.arch();
    if (plat === 'win32') return 'win-x64';
    if (plat === 'linux') return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
    if (plat === 'darwin') return arch === 'arm64' ? 'osx-arm64' : 'osx-x64';
    return 'win-x64'; // fallback
}

function getCliBinaryName(): string {
    return os.platform() === 'win32' ? 'SQSharp.CLI.exe' : 'SQSharp.CLI';
}

// ── CLI path resolution ──────────────────────────────────────────────

function getCliPath(context: vscode.ExtensionContext): string {
    // 1. User-configured path takes priority
    const configured = vscode.workspace.getConfiguration('sqf').get<string>('sqsharpCliPath');
    if (configured && configured.trim().length > 0) {
        return configured.trim();
    }

    // 2. Bundled binary in extension
    const target = getPlatformTarget();
    const bundledPath = path.join(context.extensionPath, 'bin', target, getCliBinaryName());
    if (fs.existsSync(bundledPath)) {
        return bundledPath;
    }

    // 3. Fallback: search PATH for 'sqf'
    return 'sqf';
}

// ── CLI execution helpers ─────────────────────────────────────────────

interface CliResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

function execCli(args: string[], cwd?: string, stdin?: string): Promise<CliResult> {
    // We need context but execCli is called from many places.
    // Use a module-level context set during activation.
    const cliPath = _ctx ? getCliPath(_ctx) : 'sqf';
    return new Promise((resolve) => {
        const proc = cp.spawn(cliPath, args, {
            cwd: cwd,
            env: { ...process.env, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: '1' },
            stdio: stdin ? 'pipe' : 'pipe',
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

        if (stdin) {
            proc.stdin.write(stdin);
            proc.stdin.end();
        }

        proc.on('close', (code) => {
            resolve({ stdout, stderr, exitCode: code ?? 1 });
        });

        proc.on('error', (err) => {
            resolve({ stdout, stderr: `Failed to start SQ# CLI: ${err.message}`, exitCode: 1 });
        });
    });
}

// ── Output channel ────────────────────────────────────────────────────

let outputChannel: vscode.OutputChannel;

function getOutputChannel(): vscode.OutputChannel {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('SQ# CLI');
    }
    return outputChannel;
}

// ── Diagnostics ───────────────────────────────────────────────────────

const diagnosticCollection = vscode.languages.createDiagnosticCollection('sqsharp');

function parseDiagnostics(stderr: string, filePath: string, document: vscode.TextDocument): vscode.Diagnostic[] {
    const diags: vscode.Diagnostic[] = [];
    const docText = document.getText();

    // Format 1: file(line,col): ErrorType: message (from SqError.ToString)
    const re1 = /^(.+?)\((\d+),(\d+)\):\s*(.+)$/gm;

    // Format 2: Error: Parse error at line N, col N: message (from CLI Main catch)
    const re2 = /^Error:\s*Parse error at line\s+(\d+),\s*col\s+(\d+):\s*(.+)$/gm;

    let m: RegExpExecArray | null;

    while ((m = re1.exec(stderr)) !== null) {
        const srcFile = m[1];
        if (srcFile !== filePath && srcFile !== path.basename(filePath) && srcFile !== '<script>') {
            continue;
        }
        const line = Math.max(0, parseInt(m[2]) - 1);
        const col = Math.max(0, parseInt(m[3]) - 1);
        const msg = m[4].trim();
        const range = getErrorRange(document, line, col);
        diags.push(new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error));
    }

    while ((m = re2.exec(stderr)) !== null) {
        const line = Math.max(0, parseInt(m[1]) - 1);
        const col = Math.max(0, parseInt(m[2]) - 1);
        const msg = m[3].trim();
        const range = getErrorRange(document, line, col);
        diags.push(new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error));
    }

    // Fallback: if stderr has errors but none were parsed, show on first line
    if (diags.length === 0 && stderr.trim().length > 0) {
        const firstLine = stderr.trim().split('\n')[0].substring(0, 200);
        const range = new vscode.Range(0, 0, 0, Math.min(80, docText.split('\n')[0]?.length ?? 80));
        diags.push(new vscode.Diagnostic(range, `SQ#: ${firstLine}`, vscode.DiagnosticSeverity.Error));
    }

    return diags;
}

/** Get a reasonable error range: from column to end of word/line */
function getErrorRange(document: vscode.TextDocument, line: number, col: number): vscode.Range {
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    if (col >= lineText.length) {
        return new vscode.Range(line, Math.max(0, lineText.length - 1), line, lineText.length);
    }
    // Extend to end of current word token
    let endCol = col;
    while (endCol < lineText.length && /[a-zA-Z0-9_.#]/.test(lineText[endCol])) {
        endCol++;
    }
    if (endCol === col) { endCol = Math.min(col + 1, lineText.length); }
    return new vscode.Range(line, col, line, endCol);
}

async function runDiagnostics(document: vscode.TextDocument): Promise<void> {
    if (!isSqfLanguage(document.languageId)) {
        diagnosticCollection.delete(document.uri);
        return;
    }

    try {
        // Write current buffer to temp file — sqf compile reads from disk,
        // so unsaved changes would be invisible otherwise.
        const tmpDir = path.join(os.tmpdir(), 'sqf-lint');
        fs.mkdirSync(tmpDir, { recursive: true });
        const tmpFile = path.join(tmpDir, path.basename(document.uri.fsPath));
        fs.writeFileSync(tmpFile, document.getText(), 'utf8');

        const result = await execCli(['compile', tmpFile]);
        const diags = parseDiagnostics(result.stderr, tmpFile, document);

        // Clean up temp file
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

        if (result.exitCode === 0 && diags.length === 0) {
            diagnosticCollection.delete(document.uri);
            return;
        }

        diagnosticCollection.set(document.uri, diags);
    } catch {
        // CLI not available — clear diagnostics
        diagnosticCollection.delete(document.uri);
    }
}

// ── Command handlers ──────────────────────────────────────────────────

async function compileFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isSqfLanguage(editor.document.languageId)) {
        vscode.window.showWarningMessage('SQ# compile only available for .sqf files.');
        return;
    }

    const filePath = editor.document.uri.fsPath;
    const channel = getOutputChannel();
    channel.clear();
    channel.show(true);
    channel.appendLine(`SQ# compile ${filePath}`);

    const result = await execCli(['compile', filePath]);
    channel.appendLine(result.stdout);
    if (result.stderr) {
        channel.appendLine(result.stderr);
    }
    channel.appendLine(result.exitCode === 0 ? 'OK' : `Exit code: ${result.exitCode}`);
}

async function runFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isSqfLanguage(editor.document.languageId)) {
        vscode.window.showWarningMessage('SQ# run only available for .sqf files.');
        return;
    }

    const filePath = editor.document.uri.fsPath;
    const channel = getOutputChannel();
    channel.clear();
    channel.show(true);
    channel.appendLine(`SQ# run ${filePath}`);

    const result = await execCli(['run', filePath]);
    channel.appendLine(result.stdout);
    if (result.stderr) {
        channel.appendLine(result.stderr);
    }
    channel.appendLine(result.exitCode === 0 ? 'OK' : `Exit code: ${result.exitCode}`);
}

async function lexFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isSqfLanguage(editor.document.languageId)) {
        vscode.window.showWarningMessage('SQ# lex only available for .sqf files.');
        return;
    }

    const filePath = editor.document.uri.fsPath;
    const channel = getOutputChannel();
    channel.clear();
    channel.show(true);
    channel.appendLine(`SQ# lex ${filePath}`);

    const result = await execCli(['lex', filePath]);
    channel.appendLine(result.stdout);
    if (result.stderr) {
        channel.appendLine(result.stderr);
    }
}

async function parseFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isSqfLanguage(editor.document.languageId)) {
        vscode.window.showWarningMessage('SQ# parse only available for .sqf files.');
        return;
    }

    const filePath = editor.document.uri.fsPath;
    const channel = getOutputChannel();
    channel.clear();
    channel.show(true);
    channel.appendLine(`SQ# parse ${filePath}`);

    const result = await execCli(['parse', filePath]);
    channel.appendLine(result.stdout);
    if (result.stderr) {
        channel.appendLine(result.stderr);
    }
}

async function switchToSQSharp(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    await vscode.languages.setTextDocumentLanguage(editor.document, 'sqsharp');
    vscode.window.showInformationMessage('Switched to SQ# mode.');
    await runDiagnostics(editor.document);
}

async function switchToArmaSQF(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    await vscode.languages.setTextDocumentLanguage(editor.document, 'sqf');
    diagnosticCollection.delete(editor.document.uri);
    vscode.window.showInformationMessage('Switched to Arma SQF mode.');
}

// ── Wiki lookup ───────────────────────────────────────────────────────

const WIKI_BASE = 'https://community.bistudio.com/wiki/';

async function openWikiForCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isSqfLanguage(editor.document.languageId)) {
        vscode.window.showWarningMessage('Wiki lookup only available for .sqf files.');
        return;
    }

    // Get word at cursor (or selection)
    const range = editor.document.getWordRangeAtPosition(
        editor.selection.active,
        /\b[a-zA-Z_][a-zA-Z0-9_]*\b/
    );
    if (!range) {
        vscode.window.showInformationMessage('Place cursor on a command name to open wiki.');
        return;
    }

    const command = editor.document.getText(range);
    const url = WIKI_BASE + command;
    await vscode.env.openExternal(vscode.Uri.parse(url));
}

// ── Task provider ─────────────────────────────────────────────────────

interface SqfCompileTaskDef extends vscode.TaskDefinition {
    type: 'sqf-compile';
    file: string;
    binary?: boolean;
    output?: string;
}

interface SqfRunTaskDef extends vscode.TaskDefinition {
    type: 'sqf-run';
    file: string;
}

class SqfTaskProvider implements vscode.TaskProvider {
    static readonly CompileType = 'sqf-compile';
    static readonly RunType = 'sqf-run';

    async provideTasks(): Promise<vscode.Task[]> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isSqfLanguage(editor.document.languageId)) {
            return [];
        }

        const filePath = editor.document.uri.fsPath;
        const fileName = path.basename(filePath);

        const compileTask = new vscode.Task(
            { type: SqfTaskProvider.CompileType, file: filePath },
            vscode.TaskScope.Workspace,
            `Compile ${fileName}`,
            'SQ#',
            new vscode.ShellExecution(`${getCliPath(_ctx!)} compile "${filePath}"`),
            '$sqf-error'
        );

        const runTask = new vscode.Task(
            { type: SqfTaskProvider.RunType, file: filePath },
            vscode.TaskScope.Workspace,
            `Run ${fileName}`,
            'SQ#',
            new vscode.ShellExecution(`${getCliPath(_ctx!)} run "${filePath}"`),
            '$sqf-error'
        );

        return [compileTask, runTask];
    }

    resolveTask(task: vscode.Task): vscode.Task | undefined {
        const def = task.definition;
        if (def.type === SqfTaskProvider.CompileType) {
            const tdef = def as SqfCompileTaskDef;
            const args = ['compile', tdef.file];
            if (tdef.binary) { args.push('--binary'); }
            if (tdef.output) { args.push('-o', tdef.output); }
            return new vscode.Task(
                tdef,
                task.scope ?? vscode.TaskScope.Workspace,
                task.name,
                'SQ#',
                new vscode.ShellExecution(`${getCliPath(_ctx!)} ${args.map(a => `"${a}"`).join(' ')}`),
                '$sqf-error'
            );
        }
        if (def.type === SqfTaskProvider.RunType) {
            const tdef = def as SqfRunTaskDef;
            return new vscode.Task(
                tdef,
                task.scope ?? vscode.TaskScope.Workspace,
                task.name,
                'SQ#',
                new vscode.ShellExecution(`${getCliPath(_ctx!)} run "${tdef.file}"`),
                '$sqf-error'
            );
        }
        return undefined;
    }
}

// ── Status bar ────────────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem;

function updateStatusBar(editor: vscode.TextEditor | undefined): void {
    if (!statusBarItem) { return; }
    if (!editor || (editor.document.languageId !== 'sqf' && editor.document.languageId !== 'sqsharp')) {
        statusBarItem.hide();
        return;
    }
    const langId = editor.document.languageId;
    const label = langId === 'sqsharp' ? 'SQ#' : 'Arma SQF';
    statusBarItem.text = `$(code) ${label}`;
    statusBarItem.tooltip = `Language mode: ${label}. Click to switch.`;
    statusBarItem.command = langId === 'sqsharp' ? 'sqf.switchToArmaSQF' : 'sqf.switchToSQSharp';
    statusBarItem.show();
}

// ── Extension lifecycle ───────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
    _ctx = context;

    // Log bundled CLI path for debugging
    const cliPath = getCliPath(context);
    console.log(`[SQF] Using SQ# CLI: ${cliPath}`);

    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar(vscode.window.activeTextEditor);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('sqf.compile', compileFile),
        vscode.commands.registerCommand('sqf.run', runFile),
        vscode.commands.registerCommand('sqf.lexFile', lexFile),
        vscode.commands.registerCommand('sqf.parseFile', parseFile),
        vscode.commands.registerCommand('sqf.switchToSQSharp', switchToSQSharp),
        vscode.commands.registerCommand('sqf.switchToArmaSQF', switchToArmaSQF),
        vscode.commands.registerCommand('sqf.openWiki', openWikiForCommand),
    );

    // ── Language providers (IntelliSense, hover, definition, formatting) ─

    const langSelector: vscode.DocumentSelector = [
        { language: 'sqf' },
        { language: 'sqsharp' },
    ];

    // Completions
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            langSelector, new SqfCompletionProvider(), '', '.'
        ),
    );

    // Hover
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(langSelector, new SqfHoverProvider()),
    );

    // Go-to-definition
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(langSelector, new SqfDefinitionProvider()),
    );

    // Formatting
    const formatter = new SqfFormattingProvider();
    const rangeFormatter = new SqfRangeFormattingProvider();
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(langSelector, formatter),
        vscode.languages.registerDocumentRangeFormattingEditProvider(langSelector, rangeFormatter),
    );

    // Task provider
    const taskProvider = new SqfTaskProvider();
    context.subscriptions.push(
        vscode.tasks.registerTaskProvider(SqfTaskProvider.CompileType, taskProvider),
        vscode.tasks.registerTaskProvider(SqfTaskProvider.RunType, taskProvider),
    );

    // Diagnostics on save
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (vscode.workspace.getConfiguration('sqf').get<boolean>('lintOnSave', true)) {
                runDiagnostics(doc);
            }
        }),
    );

    // Diagnostics on change (debounced)
    let changeTimer: NodeJS.Timeout | undefined;
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (!vscode.workspace.getConfiguration('sqf').get<boolean>('lintOnChange', false)) {
                return;
            }
            if (!isSqfLanguage(e.document.languageId)) { return; }
            if (changeTimer) { clearTimeout(changeTimer); }
            changeTimer = setTimeout(() => runDiagnostics(e.document), 500);
        }),
    );

    // Run diagnostics on open for .sqf files
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            updateStatusBar(editor);
            if (editor && isSqfLanguage(editor.document.languageId)) {
                runDiagnostics(editor.document);
            }
        }),
    );

    // Clean up diagnostics on close
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((doc) => {
            diagnosticCollection.delete(doc.uri);
        }),
    );

    // Initial diagnostics for already-open editors
    if (vscode.window.activeTextEditor && isSqfLanguage(vscode.window.activeTextEditor.document.languageId)) {
        runDiagnostics(vscode.window.activeTextEditor.document);
    }
}

export function deactivate(): void {
    _ctx = null;
    diagnosticCollection.dispose();
    if (outputChannel) {
        outputChannel.dispose();
    }
}
