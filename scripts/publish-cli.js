/**
 * publish-cli.js
 *
 * Publishes the SQ# CLI as a self-contained single-file binary
 * for all target platforms. Called by `npm run publish-cli` and
 * automatically during `npm run vscode:prepublish` (i.e., `vsce package`).
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CLI_PROJ = path.resolve(__dirname, '..', '..', 'SQF.NET', 'src', 'SQSharp.CLI', 'SQSharp.CLI.csproj');
const BIN_DIR = path.resolve(__dirname, '..', 'bin');

// ── Platforms ────────────────────────────────────────────────────────

const PLATFORMS = [
    { rid: 'win-x64',   exe: 'SQSharp.CLI.exe' },
    { rid: 'linux-x64', exe: 'SQSharp.CLI' },
    { rid: 'osx-x64',   exe: 'SQSharp.CLI' },
    { rid: 'osx-arm64', exe: 'SQSharp.CLI' },
];

// ── Check project exists ─────────────────────────────────────────────

if (!fs.existsSync(CLI_PROJ)) {
    console.warn(`[publish-cli] SQ# CLI project not found at: ${CLI_PROJ}`);
    console.warn('[publish-cli] Skipping CLI publish. Extension will fall back to PATH lookup.');
    process.exit(0);
}

// ── Publish each platform ────────────────────────────────────────────

let hadError = false;

for (const { rid, exe } of PLATFORMS) {
    const outDir = path.join(BIN_DIR, rid);
    const exePath = path.join(outDir, exe);

    console.log(`[publish-cli] Publishing ${rid}...`);

    try {
        fs.mkdirSync(outDir, { recursive: true });

        execSync(
            `dotnet publish "${CLI_PROJ}"` +
            ` -c Release` +
            ` -r ${rid}` +
            ` --self-contained true` +
            ` -p:PublishSingleFile=true` +
            ` -p:IncludeNativeLibrariesForSelfExtract=true` +
            ` -p:DebugType=none` +
            ` -p:DebugSymbols=false` +
            ` -o "${outDir}"`,
            {
                stdio: 'inherit',
                env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1' },
            }
        );

        // .NET publish puts ALL platform binaries in outDir.
        // We only need the main executable. Clean up the publish junk.
        const files = fs.readdirSync(outDir);
        for (const f of files) {
            const full = path.join(outDir, f);
            // Keep only the main exe and .pdb (debugging)
            if (f !== exe && !f.endsWith('.pdb')) {
                try { fs.unlinkSync(full); } catch {}
            }
        }

        if (fs.existsSync(exePath)) {
            const size = (fs.statSync(exePath).size / (1024 * 1024)).toFixed(1);
            console.log(`[publish-cli]   → ${exe} (${size} MB)`);
        } else {
            console.error(`[publish-cli]   ✗ Binary not found after publish: ${exePath}`);
            hadError = true;
        }
    } catch (err) {
        console.error(`[publish-cli]   ✗ Failed: ${err.message}`);
        hadError = true;
    }
}

if (hadError) {
    console.warn('[publish-cli] Some platforms failed. Extension will fall back to PATH lookup for those.');
}

console.log('[publish-cli] Done.');
