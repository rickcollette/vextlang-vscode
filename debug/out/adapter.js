"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VextLangDebugSession = void 0;
const vscode_debugadapter_1 = require("vscode-debugadapter");
const path = require("path");
const child_process_1 = require("child_process");
class VextLangDebugSession extends vscode_debugadapter_1.DebugSession {
    constructor() {
        super();
        this._configurationDone = false;
        this._cancellationTokens = new Map();
        this._isLongPrediction = false;
        this._variableHandles = new vscode_debugadapter_1.Handles();
        this._functionBreakpoints = new Map();
        this._breakpoints = new Map();
        this.setDebuggerLinesStartAt1(true);
        this.setDebuggerColumnsStartAt1(true);
    }
    initializeRequest(response, args) {
        response.body = response.body || {};
        response.body.supportsConfigurationDoneRequest = true;
        response.body.supportsConditionalBreakpoints = true;
        response.body.supportsCompletionsRequest = true;
        response.body.supportsCancelRequest = true;
        response.body.supportsFunctionBreakpoints = true;
        response.body.supportsBreakpointLocationsRequest = true;
        response.body.supportsLogPoints = true;
        response.body.supportsEvaluateForHovers = true;
        response.body.exceptionBreakpointFilters = [
            { filter: 'raised', label: 'Raised Exceptions', description: 'Break whenever an exception is raised.', default: false },
            { filter: 'uncaught', label: 'Uncaught Exceptions', description: 'Break whenever an exception is not caught.', default: true }
        ];
        this.sendResponse(response);
    }
    configurationDoneRequest(response, args) {
        super.configurationDoneRequest(response, args);
        this._configurationDone = true;
        this.sendResponse(response);
    }
    async launchRequest(response, args) {
        if (!args.program) {
            this.sendErrorResponse(response, 3000, 'Program is required');
            return;
        }
        this._sourceFile = args.program;
        try {
            // Start the VextLang program with debug flag
            this._debugProcess = (0, child_process_1.spawn)('vextc', ['--debug', args.program, ...(args.args || [])], {
                cwd: args.cwd,
                env: args.env
            });
            this._debugProcess.stdout?.on('data', (data) => {
                this.sendEvent(new vscode_debugadapter_1.OutputEvent(data.toString(), 'stdout'));
            });
            this._debugProcess.stderr?.on('data', (data) => {
                this.sendEvent(new vscode_debugadapter_1.OutputEvent(data.toString(), 'stderr'));
            });
            this._debugProcess.on('close', (code) => {
                this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
            });
            this._debugProcess.on('error', (error) => {
                this.sendEvent(new vscode_debugadapter_1.OutputEvent(`Error: ${error.message}`, 'stderr'));
                this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
            });
            // Send initialized event
            this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
            this.sendResponse(response);
        }
        catch (error) {
            this.sendErrorResponse(response, 3001, `Failed to launch program: ${error}`);
        }
    }
    async attachRequest(response, args) {
        // For now, we'll just send initialized event
        // In a real implementation, you'd connect to a running debug server
        this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
        this.sendResponse(response);
    }
    async disconnectRequest(response, args) {
        if (this._debugProcess) {
            this._debugProcess.kill();
            this._debugProcess = undefined;
        }
        this.sendResponse(response);
    }
    async setBreakPointsRequest(response, args) {
        const path = args.source.path;
        const clientLines = args.lines || [];
        const actualBreakpoints = clientLines.map(l => {
            const bp = new vscode_debugadapter_1.Breakpoint(true, this.convertDebuggerLineToClient(l));
            bp.id = this._breakpoints.size + 1;
            return bp;
        });
        this._breakpoints.set(path, actualBreakpoints);
        response.body = {
            breakpoints: actualBreakpoints
        };
        this.sendResponse(response);
    }
    async setFunctionBreakPointsRequest(response, args) {
        const breakpoints = args.breakpoints.map(bp => {
            const functionBp = {
                name: bp.name
            };
            this._functionBreakpoints.set(bp.name, functionBp);
            return functionBp;
        });
        response.body = {
            breakpoints: breakpoints
        };
        this.sendResponse(response);
    }
    async continueRequest(response, args) {
        // Send continue command to debug process
        if (this._debugProcess && this._debugProcess.stdin) {
            this._debugProcess.stdin.write('continue\n');
        }
        this.sendResponse(response);
    }
    async nextRequest(response, args) {
        // Send next command to debug process
        if (this._debugProcess && this._debugProcess.stdin) {
            this._debugProcess.stdin.write('next\n');
        }
        this.sendResponse(response);
    }
    async stepInRequest(response, args) {
        // Send step-in command to debug process
        if (this._debugProcess && this._debugProcess.stdin) {
            this._debugProcess.stdin.write('step-in\n');
        }
        this.sendResponse(response);
    }
    async stepOutRequest(response, args) {
        // Send step-out command to debug process
        if (this._debugProcess && this._debugProcess.stdin) {
            this._debugProcess.stdin.write('step-out\n');
        }
        this.sendResponse(response);
    }
    async pauseRequest(response, args) {
        // Send pause command to debug process
        if (this._debugProcess && this._debugProcess.stdin) {
            this._debugProcess.stdin.write('pause\n');
        }
        this.sendResponse(response);
    }
    async threadsRequest(response) {
        response.body = {
            threads: [
                new vscode_debugadapter_1.Thread(VextLangDebugSession.THREAD_ID, 'VextLang Thread')
            ]
        };
        this.sendResponse(response);
    }
    async stackTraceRequest(response, args) {
        const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
        const maxLevels = typeof args.levels === 'number' ? args.levels : 10;
        const endFrame = startFrame + maxLevels;
        const frames = [];
        for (let i = startFrame; i < endFrame; i++) {
            const frame = new vscode_debugadapter_1.StackFrame(i, `frame ${i}`, this.createSource(this._sourceFile || 'unknown.vex'), this.convertDebuggerLineToClient(i + 1));
            frames.push(frame);
        }
        response.body = {
            stackFrames: frames,
            totalFrames: frames.length
        };
        this.sendResponse(response);
    }
    async scopesRequest(response, args) {
        const scopes = [
            new vscode_debugadapter_1.Scope('Local', this._variableHandles.create('local'), false),
            new vscode_debugadapter_1.Scope('Global', this._variableHandles.create('global'), true)
        ];
        response.body = {
            scopes: scopes
        };
        this.sendResponse(response);
    }
    async variablesRequest(response, args) {
        const variables = [];
        const handle = this._variableHandles.get(args.variablesReference);
        if (handle === 'local') {
            variables.push({ name: 'localVar1', value: '42', type: 'int', variablesReference: 0 }, { name: 'localVar2', value: '"hello"', type: 'string', variablesReference: 0 });
        }
        else if (handle === 'global') {
            variables.push({ name: 'globalVar1', value: '3.14', type: 'float', variablesReference: 0 }, { name: 'globalVar2', value: 'true', type: 'bool', variablesReference: 0 });
        }
        response.body = {
            variables: variables
        };
        this.sendResponse(response);
    }
    async evaluateRequest(response, args) {
        let reply;
        let variablesReference = 0;
        if (args.context === 'repl') {
            // Handle REPL evaluation
            reply = `Evaluated: ${args.expression}`;
        }
        else if (args.context === 'hover') {
            // Handle hover evaluation
            reply = `Hover: ${args.expression}`;
        }
        else {
            // Handle watch evaluation
            reply = `Watch: ${args.expression}`;
        }
        response.body = {
            result: reply,
            type: 'string',
            variablesReference: variablesReference
        };
        this.sendResponse(response);
    }
    async completionsRequest(response, args) {
        const completions = [
            { label: 'localVar1', type: 'variable' },
            { label: 'localVar2', type: 'variable' },
            { label: 'globalVar1', type: 'variable' },
            { label: 'globalVar2', type: 'variable' },
            { label: 'print', type: 'function' },
            { label: 'len', type: 'function' },
            { label: 'push', type: 'function' }
        ];
        response.body = {
            targets: completions
        };
        this.sendResponse(response);
    }
    async exceptionInfoRequest(response, args) {
        response.body = {
            exceptionId: 'exception',
            description: 'An exception occurred',
            breakMode: 'always',
            details: {
                message: 'Runtime error',
                typeName: 'RuntimeException',
                fullTypeName: 'vextlang.RuntimeException',
                evaluateName: 'exception',
                stackTrace: 'at main() in main.vex:10'
            }
        };
        this.sendResponse(response);
    }
    async readMemoryRequest(response, args) {
        // For now, return empty memory
        response.body = {
            address: args.memoryReference,
            data: ''
        };
        this.sendResponse(response);
    }
    async writeMemoryRequest(response, args) {
        // For now, just acknowledge
        response.body = {
            bytesWritten: args.data.length
        };
        this.sendResponse(response);
    }
    async disassembleRequest(response, args) {
        // For now, return empty disassembly
        response.body = {
            instructions: []
        };
        this.sendResponse(response);
    }
    async cancelRequest(response, args) {
        if (args.requestId) {
            this._cancellationTokens.set(args.requestId, true);
        }
        this.sendResponse(response);
    }
    createSource(filePath) {
        return new vscode_debugadapter_1.Source(path.basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'vextlang-adapter-data');
    }
}
exports.VextLangDebugSession = VextLangDebugSession;
VextLangDebugSession.THREAD_ID = 1;
//# sourceMappingURL=adapter.js.map