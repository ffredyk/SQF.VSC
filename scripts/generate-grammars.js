/**
 * generate-grammars.js
 * 
 * Generates sqf.tmLanguage.json and sqsharp.tmLanguage.json
 * with proper JSON formatting. Reads reference.txt for Arma commands.
 * Uses Node.js JSON.stringify — no PowerShell Unicode mangling.
 */

const fs = require('fs');
const path = require('path');

const REFERENCE = path.resolve(__dirname, '..', '..', 'SQF.NET', 'reference.txt');
const SQF_OUT = path.resolve(__dirname, '..', 'syntaxes', 'sqf.tmLanguage.json');
const SQS_OUT = path.resolve(__dirname, '..', 'syntaxes', 'sqsharp.tmLanguage.json');

// ── Step 1: Extract commands from reference.txt ──────────────────────

function extractCommands() {
    if (!fs.existsSync(REFERENCE)) {
        console.warn('reference.txt not found. Using built-in command list.');
        return [];
    }
    const content = fs.readFileSync(REFERENCE, 'utf8');
    const re = /^    ([a-zA-Z_][a-zA-Z0-9_]*)\s*$/gm;
    const cmds = new Set();
    let m;
    while ((m = re.exec(content)) !== null) {
        cmds.add(m[1]);
    }
    return [...cmds].sort();
}

const allCommands = extractCommands();
console.log(`Extracted ${allCommands.length} commands from reference.txt`);

// ── Step 2: Group commands by first letter ──────────────────────────

function groupByFirstLetter(cmds) {
    const groups = {};
    for (const c of cmds) {
        const k = c[0].toLowerCase();
        if (!groups[k]) groups[k] = [];
        groups[k].push(c);
    }
    return groups;
}

const commandGroups = groupByFirstLetter(allCommands);
const sortedKeys = Object.keys(commandGroups).sort();
console.log(`Grouped into ${sortedKeys.length} letter groups`);

// ── Step 3: Build command patterns ──────────────────────────────────

function buildCommandPatterns() {
    return sortedKeys.map(k => ({
        name: 'support.function.sqf',
        match: `\\b(${commandGroups[k].join('|')})\\b`
    }));
}

// ── Step 4: Build SQF grammar ───────────────────────────────────────

const sqfGrammar = {
    $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: 'Arma SQF',
    scopeName: 'source.sqf',
    patterns: [
        { include: '#comments' },
        { include: '#strings' },
        { include: '#numbers' },
        { include: '#preprocessor' },
        { include: '#control-keywords' },
        { include: '#constants' },
        { include: '#declarations' },
        { include: '#operators' },
        { include: '#code-blocks' },
        { include: '#builtin-commands' },
        { include: '#variables' },
    ],
    repository: {
        comments: {
            patterns: [
                { name: 'comment.line.double-slash.sqf', match: '//.*$' },
                {
                    name: 'comment.block.sqf',
                    begin: '/\\*',
                    end: '\\*/',
                    patterns: [{ include: '#comments' }]
                }
            ]
        },
        strings: {
            patterns: [
                {
                    name: 'string.quoted.double.sqf',
                    begin: '"',
                    end: '"',
                    patterns: [{ name: 'constant.character.escape.sqf', match: '\\"' }]
                },
                {
                    name: 'string.quoted.single.sqf',
                    begin: "'",
                    end: "'",
                    patterns: [{ name: 'constant.character.escape.sqf', match: "''" }]
                }
            ]
        },
        numbers: {
            patterns: [
                { name: 'constant.numeric.hex.sqf', match: '\\$[0-9a-fA-F]+\\b|0x[0-9a-fA-F]+\\b' },
                { name: 'constant.numeric.float.sqf', match: '\\b\\d+\\.\\d+([eE][+-]?\\d+)?\\b' },
                { name: 'constant.numeric.integer.sqf', match: '\\b\\d+\\b' }
            ]
        },
        preprocessor: {
            patterns: [
                {
                    name: 'keyword.control.preprocessor.sqf',
                    match: '^\\s*#(include|define|undef|ifdef|ifndef|else|endif|pragma)\\b'
                },
                {
                    name: 'string.unquoted.preprocessor.sqf',
                    match: '(?<=^\\s*#include\\s+)<[^>]+>'
                },
                {
                    name: 'string.quoted.double.preprocessor.sqf',
                    match: '(?<=^\\s*#include\\s+)"[^"]+"'
                }
            ]
        },
        'control-keywords': {
            patterns: [
                {
                    name: 'keyword.control.conditional.sqf',
                    match: '\\b(if|then|else|switch|case|default)\\b'
                },
                {
                    name: 'keyword.control.loop.sqf',
                    match: '\\b(while|for|do|from|to|step|forEach|forEachMember|forEachMemberAgent|forEachMemberTeam)\\b'
                },
                {
                    name: 'keyword.control.exception.sqf',
                    match: '\\b(try|catch|throw|exitWith)\\b'
                },
                {
                    name: 'keyword.control.flow.sqf',
                    match: '\\b(return|breakOut|breakTo|continueWith|waitUntil|sleep|uiSleep|call|spawn|execVM|terminate|scriptDone|scriptNull|isNil|exit|exitWith)\\b'
                }
            ]
        },
        constants: {
            patterns: [
                { name: 'constant.language.boolean.sqf', match: '\\b(true|false)\\b' },
                {
                    name: 'constant.language.null.sqf',
                    match: '\\b(nil|objNull|grpNull|controlNull|displayNull|taskNull|teamMemberNull|locationNull|configNull|diaryRecordNull|scriptNull|typeName|typename|netObjNull)\\b'
                },
                {
                    name: 'constant.language.side.sqf',
                    match: '\\b(west|east|resistance|civilian|sideEnemy|sideFriendly|sideUnknown|sideLogic|sideEmpty|sideAmbientLife|opfor|blufor|independent)\\b'
                }
            ]
        },
        declarations: {
            patterns: [
                {
                    name: 'keyword.control.declaration.sqf',
                    match: '\\b(private|params|param|scopeName|scopeCheck)\\b'
                },
                {
                    name: 'keyword.control.modifier.sqf',
                    match: '\\b(global|missionNamespace|uiNamespace|parsingNamespace|profileNamespace)\\b'
                }
            ]
        },
        operators: {
            patterns: [
                { name: 'keyword.operator.comparison.sqf', match: '==|!=|>=|<=|>|<' },
                { name: 'keyword.operator.logical.sqf', match: '&&|\\|\\||!|\\band\\b|\\bor\\b|\\bnot\\b' },
                { name: 'keyword.operator.arithmetic.sqf', match: '\\+|\\-|\\*|/|%|\\^' },
                { name: 'keyword.operator.assignment.sqf', match: '=' },
                { name: 'keyword.operator.hash.sqf', match: '#' },
                { name: 'keyword.operator.other.sqf', match: ':' },
            ]
        },
        'code-blocks': {
            patterns: [
                {
                    name: 'meta.block.sqf',
                    begin: '\\{',
                    end: '\\}',
                    patterns: [
                        { include: '#comments' },
                        { include: '#strings' },
                        { include: '#numbers' },
                        { include: '#control-keywords' },
                        { include: '#constants' },
                        { include: '#declarations' },
                        { include: '#operators' },
                        { include: '#code-blocks' },
                        { include: '#builtin-commands' },
                        { include: '#variables' },
                    ]
                }
            ]
        },
        variables: {
            patterns: [
                {
                    name: 'variable.other.local.sqf',
                    match: '\\b_[a-zA-Z_][a-zA-Z0-9_]*\\b'
                },
                {
                    name: 'variable.other.magic.sqf',
                    match: '\\b(_x|_this|_forEachIndex|_exception)\\b'
                },
                {
                    name: 'variable.other.global.sqf',
                    match: '\\b[a-zA-Z][a-zA-Z0-9_]*\\b'
                }
            ]
        },
        'builtin-commands': {
            patterns: buildCommandPatterns()
        }
    }
};

// ── Step 5: Build SQ# grammar ───────────────────────────────────────

const sqsharpGrammar = {
    $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: 'SQ# (SQF Sharp)',
    scopeName: 'source.sqsharp',
    patterns: [
        { include: '#comments' },
        { include: '#strings' },
        { include: '#numbers' },
        { include: '#control-keywords' },
        { include: '#sqsharp-keywords' },
        { include: '#constants' },
        { include: '#declarations' },
        { include: '#operators' },
        { include: '#code-blocks' },
        { include: '#builtin-commands' },
        { include: '#variables' },
    ],
    repository: {
        comments: {
            patterns: [
                { name: 'comment.line.double-slash.sqsharp', match: '//.*$' },
                {
                    name: 'comment.block.sqsharp',
                    begin: '/\\*',
                    end: '\\*/',
                    patterns: [{ include: '#comments' }]
                }
            ]
        },
        strings: {
            patterns: [
                {
                    name: 'string.quoted.double.sqsharp',
                    begin: '"',
                    end: '"',
                    patterns: [{ name: 'constant.character.escape.sqsharp', match: '\\"' }]
                },
                {
                    name: 'string.quoted.single.sqsharp',
                    begin: "'",
                    end: "'",
                    patterns: [{ name: 'constant.character.escape.sqsharp', match: "''" }]
                }
            ]
        },
        numbers: {
            patterns: [
                { name: 'constant.numeric.hex.sqsharp', match: '\\$[0-9a-fA-F]+\\b|0x[0-9a-fA-F]+\\b' },
                { name: 'constant.numeric.float.sqsharp', match: '\\b\\d+\\.\\d+([eE][+-]?\\d+)?\\b' },
                { name: 'constant.numeric.integer.sqsharp', match: '\\b\\d+\\b' }
            ]
        },
        'control-keywords': {
            patterns: [
                {
                    name: 'keyword.control.conditional.sqsharp',
                    match: '\\b(if|then|else|switch|case|default)\\b'
                },
                {
                    name: 'keyword.control.loop.sqsharp',
                    match: '\\b(while|for|do|from|to|step|forEach)\\b'
                },
                {
                    name: 'keyword.control.exception.sqsharp',
                    match: '\\b(try|catch|throw)\\b'
                },
                {
                    name: 'keyword.control.flow.sqsharp',
                    match: '\\b(return|call|spawn|spawnOn|execVM|terminate|scriptDone|scriptNull)\\b'
                }
            ]
        },
        'sqsharp-keywords': {
            patterns: [
                {
                    name: 'keyword.control.concurrency.sqsharp',
                    match: '\\b(shared|freeze|thaw|Channel|sendTo|scheduler|owner)\\b'
                },
                {
                    name: 'keyword.control.module.sqsharp',
                    match: '\\b(import)\\b'
                }
            ]
        },
        constants: {
            patterns: [
                { name: 'constant.language.boolean.sqsharp', match: '\\b(true|false)\\b' },
                {
                    name: 'constant.language.null.sqsharp',
                    match: '\\b(nil|Nothing)\\b'
                },
                {
                    name: 'constant.language.type.sqsharp',
                    match: '\\b(Boolean|Number|String|Array|Code|HashMap|Namespace|ScriptHandle|Error|FrozenArray|Channel|Shared|Scheduler|HostType)\\b'
                }
            ]
        },
        declarations: {
            patterns: [
                {
                    name: 'keyword.control.declaration.sqsharp',
                    match: '\\b(private|params|shared|import|global)\\b'
                },
                {
                    name: 'keyword.control.modifier.sqsharp',
                    match: '\\b(missionNamespace|uiNamespace|parsingNamespace|profileNamespace|schedulerNamespace)\\b'
                }
            ]
        },
        operators: {
            patterns: [
                { name: 'keyword.operator.comparison.sqsharp', match: '==|!=|>=|<=|>|<' },
                { name: 'keyword.operator.logical.sqsharp', match: '&&|\\|\\||!|\\band\\b|\\bor\\b|\\bnot\\b' },
                { name: 'keyword.operator.arithmetic.sqsharp', match: '\\+|\\-|\\*|/|%|\\^' },
                { name: 'keyword.operator.assignment.sqsharp', match: '=' },
                { name: 'keyword.operator.hash.sqsharp', match: '#' },
                { name: 'keyword.operator.other.sqsharp', match: ':' },
            ]
        },
        'code-blocks': {
            patterns: [
                {
                    name: 'meta.block.sqsharp',
                    begin: '\\{',
                    end: '\\}',
                    patterns: [
                        { include: '#comments' },
                        { include: '#strings' },
                        { include: '#numbers' },
                        { include: '#control-keywords' },
                        { include: '#sqsharp-keywords' },
                        { include: '#constants' },
                        { include: '#declarations' },
                        { include: '#operators' },
                        { include: '#code-blocks' },
                        { include: '#builtin-commands' },
                        { include: '#variables' },
                    ]
                }
            ]
        },
        variables: {
            patterns: [
                {
                    name: 'variable.other.local.sqsharp',
                    match: '\\b_[a-zA-Z_][a-zA-Z0-9_]*\\b'
                },
                {
                    name: 'variable.other.magic.sqsharp',
                    match: '\\b(_x|_this|_forEachIndex|_exception)\\b'
                },
                {
                    name: 'variable.other.global.sqsharp',
                    match: '\\b[a-zA-Z][a-zA-Z0-9_]*\\b'
                }
            ]
        },
        'builtin-commands': {
            patterns: buildCommandPatterns().map(p => ({
                name: 'support.function.sqsharp',
                match: p.match
            }))
        }
    }
};

// ── Step 6: Write files ─────────────────────────────────────────────

fs.writeFileSync(SQF_OUT, JSON.stringify(sqfGrammar, null, 2), 'utf8');
console.log(`Written: ${SQF_OUT}`);

fs.writeFileSync(SQS_OUT, JSON.stringify(sqsharpGrammar, null, 2), 'utf8');
console.log(`Written: ${SQS_OUT}`);

console.log('Done. Grammars generated with clean JSON.');
