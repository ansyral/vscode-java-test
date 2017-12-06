// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { workspace, Uri } from 'vscode';
import { Test, TestSuite } from './protocols';

export class TestResourceManager {
    private testsIndexedByFileUri = new Map<string, Test | null | undefined>();

    public getTests(file: Uri): Test | undefined {
        const path = file.path || '';
        return this.testsIndexedByFileUri.has(path) ? this.testsIndexedByFileUri.get(path) : undefined;
    }
    public storeTests(file: Uri, tests: TestSuite[] | null | undefined): void {
        const path = file.path || '';
        const test: Test = {
            dirty: false,
            tests,
        };
        this.testsIndexedByFileUri.set(path, test);
    }
    public setDirty(file: Uri): void {
        const test = this.getTests(file);
        if (test) {
            test.dirty = true;
        }
    }
    public isDirty(file: Uri): boolean | undefined {
        const test = this.getTests(file);
        return test ? test.dirty : undefined;
    }
    public dispose() {
        this.testsIndexedByFileUri.clear();
    }
}
