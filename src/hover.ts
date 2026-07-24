import * as vscode from 'vscode';

// ── Hover docs for common SQ#/SQF commands ────────────────────────────

const HOVER_DOCS: Record<string, string> = {
    // Control flow
    "if": "**if** (condition) **then** {code}\n\nUnary operator. Returns If type for chaining with then/else.",
    "then": "IfType **then** {code}\n\nBinary operator. Evaluates code if IfType condition was true.",
    "else": "IfType **else** {code}\n\nBinary operator (precedence 5). Provides else-branch for if-then.",
    "while": "**while** {condition} **do** {body}\n\nUnary operator. Returns While type. Loop while condition is true.",
    "for": "**for** [{init}, {cond}, {step}] **do** {body}\n\nUnary operator. C-style for loop. Also: **for** \"_i\" **from** 0 **to** 10 **do** {...}",
    "switch": "**switch** (value) **do** {case val: {...}; default {...};}\n\nUnary operator. Multi-way branch.",
    "try": "**try** {code} **catch** {handler}\n\nUnary operator (SQ#). Exception handling block.",
    "throw": "**throw** value\n\nUnary operator (SQ#). Throw an error value.",
    "return": "**return** value\n\nUnary operator. Exit current scope with value.",
    "call": "**call** {code}\n\nUnary operator. Execute code in current scheduler. Also: _args **call** {code} (binary).",
    "spawn": "**spawn** {code}\n\nUnary operator. Execute code in new fiber. Also: _args **spawn** {code} (binary).",
    "spawnOn": "**spawnOn** [schedulerName, {code}]\n\nUnary/binary operator (SQ#). Execute code on target scheduler.",
    "execVM": "**execVM** \"script.sqf\"\n\nUnary operator. Load and execute external script file.",

    // Declarations
    "private": "**private** [_var1, _var2]\n\nNular operator accepting array. Declares local variables in current scope.",
    "params": "**params** [_param1, _param2]\n\nUnary operator. Unpacks _this array into named variables.",
    "shared": "**shared** _var = value\n\nDeclaration keyword (SQ#). Creates atomic CAS-based variable.",
    "import": "**import** name\n\nDeclaration keyword (SQ#). Import module/namespace.",
    "global": "**global** var\n\nDeclaration keyword (SQ#). Declare global variable in current scheduler.",

    // Concurrency (SQ#)
    "freeze": "**freeze** value\n\nUnary operator (SQ#). Make value immutable for cross-scheduler sharing.",
    "thaw": "**thaw** frozenValue\n\nUnary operator (SQ#). Convert frozen value back to mutable.",

    // Common commands
    "count": "**count** array\n\nUnary operator. Returns number of elements in array or string.",
    "select": "_array **select** index\n\nBinary operator. Returns element at index (0-based).",
    "set": "_array **set** [index, value]\n\nBinary operator. Sets element at index. Right side must be [index, value].",
    "pushBack": "_array **pushBack** value\n\nBinary operator. Appends value to end of array. Returns index.",
    "append": "_array **append** otherArray\n\nBinary operator. Appends all elements of otherArray.",
    "deleteAt": "_array **deleteAt** index\n\nBinary operator. Removes element at index. Returns deleted value.",
    "deleteRange": "_array **deleteRange** [start, count]\n\nBinary operator. Removes range of elements.",
    "find": "_array **find** value\n\nBinary operator. Returns first index of value, or -1 if not found.",
    "findIf": "_array **findIf** {condition}\n\nBinary operator. Returns first index where condition is true.",
    "resize": "_array **resize** newSize\n\nBinary operator. Resizes array. Truncates or fills with nil.",
    "reverse": "**reverse** array\n\nUnary operator. Returns reversed copy of array.",
    "sort": "_array **sort** ascending\n\nBinary operator. Sorts array in place. ascending: true/false.",
    "selectRandom": "**selectRandom** array\n\nUnary operator. Returns random element from array.",
    "apply": "_array **apply** {_x * 2}\n\nBinary operator. Returns new array with code applied to each element.",
    "selectMax": "_array **selectMax** {criteria}\n\nBinary operator. Returns element with maximum criteria value.",
    "selectMin": "_array **selectMin** {criteria}\n\nBinary operator. Returns element with minimum criteria value.",

    // HashMaps
    "createHashMap": "**createHashMap**\n\nNular operator (SQ#). Creates empty HashMap.",
    "createHashMapFromArray": "**createHashMapFromArray** [[key,val], ...]\n\nUnary operator. Creates HashMap from key-value pairs.",
    "get": "_hashMap **get** key\n\nBinary operator. Returns value for key, or nil if not found.",
    "setVariable": "_namespace **setVariable** [name, value]\n\nBinary operator. Sets named variable in namespace.",
    "getVariable": "_namespace **getVariable** name\n\nBinary operator. Gets named variable from namespace.",

    // Strings
    "format": "**format** [template, arg1, arg2, ...]\n\nUnary operator. Returns formatted string. %1, %2 are placeholders.",
    "str": "**str** value\n\nUnary operator. Converts any value to string representation.",
    "countString": "_string **countString** sub\n\nBinary operator. Counts occurrences of substring.",
    "splitString": "_string **splitString** delimiter\n\nBinary operator. Splits string into array by delimiter.",
    "joinString": "_array **joinString** delimiter\n\nBinary operator. Joins array of strings with delimiter.",
    "toUpper": "**toUpper** string\n\nUnary operator. Converts string to uppercase.",
    "toLower": "**toLower** string\n\nUnary operator. Converts string to lowercase.",
    "trim": "**trim** string\n\nUnary operator. Removes leading/trailing whitespace.",
    "toArray": "**toArray** string\n\nUnary operator. Converts string to array of character codes.",

    // Math
    "abs": "**abs** number\n\nUnary operator. Returns absolute value.",
    "sin": "**sin** angle\n\nUnary operator. Sine of angle in degrees.",
    "cos": "**cos** angle\n\nUnary operator. Cosine of angle in degrees.",
    "tan": "**tan** angle\n\nUnary operator. Tangent of angle in degrees.",
    "asin": "**asin** value\n\nUnary operator. Arc sine, returns degrees.",
    "acos": "**acos** value\n\nUnary operator. Arc cosine, returns degrees.",
    "atan": "**atan** value\n\nUnary operator. Arc tangent, returns degrees.",
    "atan2": "x **atan2** y\n\nBinary operator. Arc tangent of y/x, returns degrees.",
    "sqrt": "**sqrt** value\n\nUnary operator. Square root.",
    "exp": "**exp** value\n\nUnary operator. e^value.",
    "log": "**log** value\n\nUnary operator. Natural logarithm.",
    "floor": "**floor** value\n\nUnary operator. Round down to integer.",
    "ceil": "**ceil** value\n\nUnary operator. Round up to integer.",
    "round": "**round** value\n\nUnary operator. Round to nearest integer.",
    "random": "**random** max\n\nUnary operator. Returns random float [0, max).",
    "pi": "**pi**\n\nNular constant. Returns π (3.14159...).",
    "deg": "**deg** radians\n\nUnary operator. Converts radians to degrees.",
    "rad": "**rad** degrees\n\nUnary operator. Converts degrees to radians.",
    "min": "a **min** b\n\nBinary operator. Returns smaller of two numbers.",
    "max": "a **max** b\n\nBinary operator. Returns larger of two numbers.",
    "pow": "base **pow** exp\n\nBinary operator (SQ#). Returns base raised to exponent.",
    "linearConversion": "**linearConversion** [minFrom, maxFrom, minTo, maxTo, value, clip]\n\nUnary operator. Linear interpolation/conversion.",

    // Comparison / Logic
    "isNil": "**isNil** value\n\nUnary operator. Returns true if value is nil.",
    "isNull": "**isNull** object\n\nUnary operator. Returns true if object is null.",
    "isEqualTo": "a **isEqualTo** b\n\nBinary operator. Deep structural equality check.",
    "isEqualType": "a **isEqualType** b\n\nBinary operator. Returns true if types match.",
    "isKindOf": "object **isKindOf** typeName\n\nBinary operator. Checks object inheritance.",
    "isServer": "**isServer**\n\nNular operator. Returns true on server/multiplayer host.",
    "isDedicated": "**isDedicated**\n\nNular operator. Returns true on dedicated server.",
    "hasInterface": "**hasInterface**\n\nNular operator. Returns true if machine has player UI.",
    "isPlayer": "**isPlayer** object\n\nUnary operator. Returns true if object is a human player.",

    // Output
    "hint": "**hint** message\n\nUnary operator. Shows hint message to local player.",
    "systemChat": "**systemChat** message\n\nUnary operator. Prints to system chat.",
    "diag_log": "**diag_log** message\n\nUnary operator. Logs message to diagnostics log.",
    "textLog": "**textLog** message\n\nUnary operator. Logs text to game log.",
    "echo": "**echo** message\n\nUnary operator. Debug echo (editor).",

    // Objects
    "player": "**player**\n\nNular operator. Returns the local player object.",
    "allPlayers": "**allPlayers**\n\nNular operator. Returns array of all human players.",
    "allUnits": "**allUnits**\n\nNular operator. Returns array of all alive units.",
    "allDead": "**allDead**\n\nNular operator. Returns array of all dead units.",
    "vehicles": "**vehicles**\n\nNular operator. Returns array of all vehicles.",
    "allGroups": "**allGroups**\n\nNular operator. Returns array of all groups.",
    "nearObjects": "pos **nearObjects** radius\n\nBinary operator. Returns objects within radius of position.",
    "nearestObject": "pos **nearestObject** type\n\nBinary operator. Returns nearest object of given type.",
    "nearestObjects": "pos **nearestObjects** [types, radius]\n\nBinary operator. Returns nearest objects.",

    // SQ# scheduler
    "currentScheduler": "**currentScheduler**\n\nNular operator (SQ#). Returns current scheduler ID.",
    "allSchedulers": "**allSchedulers**\n\nNular operator (SQ#). Returns array of all scheduler names.",
    "schedulerName": "schedulerId **schedulerName**\n\nBinary operator (SQ#). Returns name of scheduler.",
    "schedulerStats": "schedulerId **schedulerStats**\n\nBinary operator (SQ#). Returns stats HashMap for scheduler.",
    "clientOwner": "**clientOwner**\n\nNular operator (SQ#). Returns client owner ID.",
    "sendTo": "message **sendTo** schedulerName\n\nBinary operator (SQ#). Sends message via channel to scheduler.",
    "scheduler": "value **scheduler**\n\nBinary operator (SQ#). Returns scheduler ID that owns the value.",

    // Arma: position/direction
    "getPos": "**getPos** object\n\nUnary operator. Returns [x, y, z] position.",
    "getPosASL": "**getPosASL** object\n\nUnary operator. Returns position above sea level.",
    "getPosATL": "**getPosATL** object\n\nUnary operator. Returns position above terrain level.",
    "setPos": "object **setPos** [x, y, z]\n\nBinary operator. Sets object position.",
    "setPosASL": "object **setPosASL** [x, y, z]\n\nBinary operator. Sets position above sea level.",
    "getDir": "**getDir** object\n\nUnary operator. Returns direction in degrees (0-360).",
    "setDir": "object **setDir** heading\n\nBinary operator. Sets direction.",
    "direction": "**direction** object\n\nUnary operator. Alias for getDir.",
    "distance": "a **distance** b\n\nBinary operator. 3D distance between two positions/objects.",
    "speed": "**speed** object\n\nUnary operator. Returns current speed in km/h.",
    "velocity": "**velocity** object\n\nUnary operator. Returns [vx, vy, vz] velocity vector.",
    "typeOf": "**typeOf** object\n\nUnary operator. Returns class name of object.",
    "alive": "**alive** object\n\nUnary operator. Returns true if object is alive.",
    "damage": "**damage** object\n\nUnary operator. Returns damage value [0-1].",
    "setDamage": "object **setDamage** value\n\nBinary operator. Sets damage value [0-1].",
    "side": "**side** object\n\nUnary operator. Returns side enum (west/east/resistance/civilian).",
    "owner": "**owner** object\n\nUnary operator. Returns client ID that owns the object.",
    "name": "**name** object\n\nUnary operator. Returns name of unit/object.",
    "vehicle": "**vehicle** unit\n\nUnary operator. Returns vehicle unit is in, or unit itself.",
    "crew": "**crew** vehicle\n\nUnary operator. Returns array of crew in vehicle.",

    // Multiplayer
    "remoteExec": "**remoteExec** [params, codeString, target]\n\nUnary/binary operator. Executes code on remote machine(s).",
    "publicVariable": "**publicVariable** varName\n\nUnary operator. Broadcasts variable to all clients.",
    "publicVariableServer": "**publicVariableServer** varName\n\nUnary operator. Broadcasts variable to server only.",

    // Meta
    "compile": "**compile** codeString\n\nUnary operator. Compiles string into Code type.",
    "typeName": "**typeName** value\n\nUnary operator. Returns type name as string.",
    "scriptDone": "**scriptDone** handle\n\nUnary operator. Returns true if script/thread completed.",
    "terminate": "**terminate** handle\n\nUnary operator. Terminates a script/thread.",
    "sleep": "**sleep** seconds\n\nUnary operator. Suspends execution for N seconds.",
    "waitUntil": "**waitUntil** {condition}\n\nUnary operator. Suspends until condition is true.",
    "time": "**time**\n\nNular operator. Returns mission time in seconds.",
    "serverTime": "**serverTime**\n\nNular operator. Returns server time.",
};

// ── Hover provider ────────────────────────────────────────────────────

export class SqfHoverProvider implements vscode.HoverProvider {

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.Hover | undefined {
        const range = document.getWordRangeAtPosition(position, /\b[a-zA-Z_][a-zA-Z0-9_]*\b/);
        if (!range) { return undefined; }

        const word = document.getText(range);
        const doc = HOVER_DOCS[word];
        if (!doc) { return undefined; }

        return new vscode.Hover(new vscode.MarkdownString(doc), range);
    }
}
