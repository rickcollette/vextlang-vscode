import {
    DebugSession,
    InitializedEvent,
    TerminatedEvent,
    StoppedEvent,
    BreakpointEvent,
    OutputEvent,
    Thread,
    StackFrame,
    Scope,
    Source,
    Handles,
    Breakpoint
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    program: string;
    args?: string[];
    cwd?: string;
    env?: { [key: string]: string };
    stopOnEntry?: boolean;
    console?: string;
}

interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments {
    host?: string;
    port?: number;
}

export class VextLangDebugSession extends DebugSession {
    private static THREAD_ID = 1;

    private _configurationDone = false;
    private _cancellationTokens = new Map<number, boolean>();
    private _isLongPrediction = false;
    private _variableHandles = new Handles<string>();
    private _functionBreakpoints = new Map<string, DebugProtocol.FunctionBreakpoint>();
    private _debugProcess: ChildProcess | undefined;
    private _breakpoints = new Map<string, DebugProtocol.Breakpoint[]>();
    private _sourceFile: string | undefined;

    public constructor() {
        super();

        this.setDebuggerLinesStartAt1(true);
        this.setDebuggerColumnsStartAt1(true);
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
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

    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        super.configurationDoneRequest(response, args);

        this._configurationDone = true;
        this.sendResponse(response);
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): Promise<void> {
        if (!args.program) {
            this.sendErrorResponse(response, 3000, 'Program is required');
            return;
        }

        this._sourceFile = args.program;

        try {
            // Start the VextLang program with debug flag
            this._debugProcess = spawn('vextc', ['--debug', args.program, ...(args.args || [])], {
                cwd: args.cwd,
                env: args.env
            });

            this._debugProcess.stdout?.on('data', (data) => {
                this.sendEvent(new OutputEvent(data.toString(), 'stdout'));
            });

            this._debugProcess.stderr?.on('data', (data) => {
                this.sendEvent(new OutputEvent(data.toString(), 'stderr'));
            });

            this._debugProcess.on('close', (code) => {
                this.sendEvent(new TerminatedEvent());
            });

            this._debugProcess.on('error', (error) => {
                this.sendEvent(new OutputEvent(`Error: ${error.message}`, 'stderr'));
                this.sendEvent(new TerminatedEvent());
            });

            // Send initialized event
            this.sendEvent(new InitializedEvent());

            this.sendResponse(response);
        } catch (error) {
            this.sendErrorResponse(response, 3001, `Failed to launch program: ${error}`);
        }
    }

    protected async attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments): Promise<void> {
        // For now, we'll just send initialized event
        // In a real implementation, you'd connect to a running debug server
        this.sendEvent(new InitializedEvent());
        this.sendResponse(response);
    }

    protected async disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): Promise<void> {
        if (this._debugProcess) {
            this._debugProcess.kill();
            this._debugProcess = undefined;
        }
        this.sendResponse(response);
    }

    protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> {
        const path = args.source.path as string;
        const clientLines = args.lines || [];

        const actualBreakpoints = clientLines.map(l => {
            const bp = <DebugProtocol.Breakpoint>new Breakpoint(true, this.convertDebuggerLineToClient(l));
            bp.id = this._breakpoints.size + 1;
            return bp;
        });

        this._breakpoints.set(path, actualBreakpoints);

        response.body = {
            breakpoints: actualBreakpoints
        };
        this.sendResponse(response);
    }

    protected async setFunctionBreakPointsRequest(response: DebugProtocol.SetFunctionBreakpointsResponse, args: DebugProtocol.SetFunctionBreakpointsArguments): Promise<void> {
        const breakpoints = args.breakpoints.map(bp => {
            const functionBp: DebugProtocol.FunctionBreakpoint = {
                name: bp.name
            };
            this._functionBreakpoints.set(bp.name, functionBp);
            return functionBp;
        });

        response.body = {
            breakpoints: breakpoints as any[]
        };
        this.sendResponse(response);
    }

    protected async continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): Promise<void> {
        // Send continue command to debug process
        if (this._debugProcess && this._debugProcess.stdin) {
            this._debugProcess.stdin.write('continue\n');
        }
        this.sendResponse(response);
    }

    protected async nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): Promise<void> {
        // Send next command to debug process
        if (this._debugProcess && this._debugProcess.stdin) {
            this._debugProcess.stdin.write('next\n');
        }
        this.sendResponse(response);
    }

    protected async stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): Promise<void> {
        // Send step-in command to debug process
        if (this._debugProcess && this._debugProcess.stdin) {
            this._debugProcess.stdin.write('step-in\n');
        }
        this.sendResponse(response);
    }

    protected async stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): Promise<void> {
        // Send step-out command to debug process
        if (this._debugProcess && this._debugProcess.stdin) {
            this._debugProcess.stdin.write('step-out\n');
        }
        this.sendResponse(response);
    }

    protected async pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments): Promise<void> {
        // Send pause command to debug process
        if (this._debugProcess && this._debugProcess.stdin) {
            this._debugProcess.stdin.write('pause\n');
        }
        this.sendResponse(response);
    }

    protected async threadsRequest(response: DebugProtocol.ThreadsResponse): Promise<void> {
        response.body = {
            threads: [
                new Thread(VextLangDebugSession.THREAD_ID, 'VextLang Thread')
            ]
        };
        this.sendResponse(response);
    }

    protected async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): Promise<void> {
        const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
        const maxLevels = typeof args.levels === 'number' ? args.levels : 10;
        const endFrame = startFrame + maxLevels;

        const frames: StackFrame[] = [];
        for (let i = startFrame; i < endFrame; i++) {
            const frame = new StackFrame(
                i,
                `frame ${i}`,
                this.createSource(this._sourceFile || 'unknown.vex'),
                this.convertDebuggerLineToClient(i + 1)
            );
            frames.push(frame);
        }

        response.body = {
            stackFrames: frames,
            totalFrames: frames.length
        };
        this.sendResponse(response);
    }

    protected async scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): Promise<void> {
        const scopes = [
            new Scope('Local', this._variableHandles.create('local'), false),
            new Scope('Global', this._variableHandles.create('global'), true)
        ];

        response.body = {
            scopes: scopes
        };
        this.sendResponse(response);
    }

    protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): Promise<void> {
        const variables: DebugProtocol.Variable[] = [];
        const handle = this._variableHandles.get(args.variablesReference);

        if (handle === 'local') {
            variables.push(
                { name: 'localVar1', value: '42', type: 'int', variablesReference: 0 },
                { name: 'localVar2', value: '"hello"', type: 'string', variablesReference: 0 }
            );
        } else if (handle === 'global') {
            variables.push(
                { name: 'globalVar1', value: '3.14', type: 'float', variablesReference: 0 },
                { name: 'globalVar2', value: 'true', type: 'bool', variablesReference: 0 }
            );
        }

        response.body = {
            variables: variables
        };
        this.sendResponse(response);
    }

    protected async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): Promise<void> {
        let reply: string | undefined;
        let variablesReference = 0;

        if (args.context === 'repl') {
            // Handle REPL evaluation
            reply = `Evaluated: ${args.expression}`;
        } else if (args.context === 'hover') {
            // Handle hover evaluation
            reply = `Hover: ${args.expression}`;
        } else {
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

    protected async completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): Promise<void> {
        const completions: DebugProtocol.CompletionItem[] = [
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

    protected async exceptionInfoRequest(response: DebugProtocol.ExceptionInfoResponse, args: DebugProtocol.ExceptionInfoArguments): Promise<void> {
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

    protected async readMemoryRequest(response: DebugProtocol.ReadMemoryResponse, args: DebugProtocol.ReadMemoryArguments): Promise<void> {
        // For now, return empty memory
        response.body = {
            address: args.memoryReference,
            data: ''
        };
        this.sendResponse(response);
    }

    protected async writeMemoryRequest(response: DebugProtocol.WriteMemoryResponse, args: DebugProtocol.WriteMemoryArguments): Promise<void> {
        // For now, just acknowledge
        response.body = {
            bytesWritten: args.data.length
        };
        this.sendResponse(response);
    }

    protected async disassembleRequest(response: DebugProtocol.DisassembleResponse, args: DebugProtocol.DisassembleArguments): Promise<void> {
        // For now, return empty disassembly
        response.body = {
            instructions: []
        };
        this.sendResponse(response);
    }

    protected async cancelRequest(response: DebugProtocol.CancelResponse, args: DebugProtocol.CancelArguments): Promise<void> {
        if (args.requestId) {
            this._cancellationTokens.set(args.requestId, true);
        }
        this.sendResponse(response);
    }

    private createSource(filePath: string): Source {
        return new Source(path.basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'vextlang-adapter-data');
    }
} 