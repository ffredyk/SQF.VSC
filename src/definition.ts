import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// ── Go-to-definition provider ─────────────────────────────────────────

export class SqfDefinitionProvider implements vscode.DefinitionProvider {

    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.Definition | undefined {
        const line = document.lineAt(position).text;

        // ── #include "file.sqf" ──
        const includeMatch = line.match(/^\s*#include\s+"([^"]+)"/);
        if (includeMatch) {
            const includePath = includeMatch[1];
            const fullPath = this.resolveIncludePath(document, includePath);
            if (fullPath && fs.existsSync(fullPath)) {
                return new vscode.Location(
                    vscode.Uri.file(fullPath),
                    new vscode.Position(0, 0)
                );
            }
        }

        // ── call / execVM "file.sqf" ──
        const callMatch = line.match(/(?:call|spawn|execVM)\s+"([^"]+)"/);
        if (callMatch) {
            const scriptPath = callMatch[1];
            const fullPath = this.resolveIncludePath(document, scriptPath);
            if (fullPath && fs.existsSync(fullPath)) {
                return new vscode.Location(
                    vscode.Uri.file(fullPath),
                    new vscode.Position(0, 0)
                );
            }
        }

        return undefined;
    }

    private resolveIncludePath(document: vscode.TextDocument, includePath: string): string | null {
        // Try relative to current file first
        const currentDir = path.dirname(document.uri.fsPath);
        const relativePath = path.join(currentDir, includePath);
        if (fs.existsSync(relativePath)) {
            return relativePath;
        }

        // Try workspace root
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            const wsPath = path.join(workspaceFolder.uri.fsPath, includePath);
            if (fs.existsSync(wsPath)) {
                return wsPath;
            }
        }

        return null;
    }
}
