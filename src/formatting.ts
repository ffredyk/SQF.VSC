import * as vscode from 'vscode';

// ── Simple indentation formatter ─────────────────────────────────────

export class SqfFormattingProvider implements vscode.DocumentFormattingEditProvider {

    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
    ): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const tabSize = vscode.workspace.getConfiguration('editor', document).get<number>('tabSize', 4);
        const insertSpaces = vscode.workspace.getConfiguration('editor', document).get<boolean>('insertSpaces', true);

        let indentLevel = 0;
        const lines = document.getText().split('\n');

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const trimmed = rawLine.trimStart();

            // Skip empty lines
            if (trimmed.length === 0) { continue; }

            // Decrease indent BEFORE lines that start with closing bracket
            if (trimmed.startsWith('}') || trimmed.startsWith('];')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            // Calculate correct indent
            const indentStr = insertSpaces
                ? ' '.repeat(indentLevel * tabSize)
                : '\t'.repeat(indentLevel);

            // Apply if current indent differs
            const currentLeading = rawLine.match(/^[ \t]*/)?.[0] ?? '';
            if (currentLeading !== indentStr) {
                const range = new vscode.Range(i, 0, i, currentLeading.length);
                edits.push(vscode.TextEdit.replace(range, indentStr));
            }

            // Increase indent AFTER lines that open a block
            const openCount = (trimmed.match(/\{(?!\})/g) || []).length;
            const closeCount = (trimmed.match(/\}/g) || []).length;
            indentLevel += openCount - closeCount;

            // Also increase after 'then', 'do', 'else' at end of line
            if (/\b(then|do|else|default)\s*$/.test(trimmed) && !trimmed.includes('{')) {
                // Don't increase if already handled by brace count
                const hasOpenBrace = trimmed.includes('{');
                if (!hasOpenBrace) {
                    // Look ahead: if next non-empty line starts with {, the brace count handles it
                    // Otherwise, we might want to handle single-statement bodies
                }
            }

            // Clamp
            indentLevel = Math.max(0, indentLevel);
        }

        return edits;
    }
}

export class SqfRangeFormattingProvider implements vscode.DocumentRangeFormattingEditProvider {

    provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
    ): vscode.TextEdit[] {
        // For range formatting, delegate to full document formatting
        // but only return edits within the range
        const fullProvider = new SqfFormattingProvider();
        const allEdits = fullProvider.provideDocumentFormattingEdits(document);
        return allEdits.filter(e => range.contains(e.range));
    }
}
