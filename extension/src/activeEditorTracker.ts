
'use strict';
import { commands, window, Disposable, TextEditor } from 'vscode';

export class ActiveEditorTracker extends Disposable {

    private _disposable: Disposable;
    private _resolver: ((value?: TextEditor | PromiseLike<TextEditor>) => void) | undefined;

    constructor() {
        super(() => this.dispose());

        this._disposable = window.onDidChangeActiveTextEditor((e) => this._resolver && this._resolver(e));
    }

    public dispose() {
        if (this._disposable) {
            this._disposable.dispose();
        }
    }

    public async awaitNextGroup(timeout: number = 500): Promise<TextEditor> {
        this.nextGroup();
        return this.wait(timeout);
    }

    public async awaitNext(timeout: number = 500): Promise<TextEditor> {
        this.next();
        return this.wait(timeout);
    }

    public async next(): Promise<{} | undefined> {
        return commands.executeCommand('workbench.action.nextEditor');
    }

    public async nextGroup(): Promise<{} | undefined> {
        return commands.executeCommand('workbench.action.focusNextGroup');
    }

    public async wait(timeout: number = 500): Promise<TextEditor> {
        const editor = await new Promise<TextEditor>((resolve, reject) => {
            let timer: any;

            this._resolver = (e: TextEditor) => {
                if (timer) {
                    clearTimeout(timer as any);
                    timer = 0;
                    resolve(e);
                }
            };

            timer = setTimeout(() => {
                resolve(window.activeTextEditor);
                timer = 0;
            }, timeout) as any;
        });
        this._resolver = undefined;
        return editor;
    }
}
