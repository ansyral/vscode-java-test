// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TextDocument, WorkspaceFolder } from 'vscode';
import * as Commands from '../Constants/commands';
import { TestSuite } from '../Models/protocols';

export function fetchTests(document: TextDocument): Thenable<TestSuite[]> {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_FETCH_TEST, document.uri.toString()).then((tests: TestSuite[]) => {
        transformIndex(tests);
        return tests;
    },
    (reason) => {
        return Promise.reject(reason);
    });
}

export function searchAllTests(): Thenable<any> {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_SEARCH_ALL_TESTS).then((tests: TestSuite[]) => {
        transformIndex(tests);
        return tests;
    },
    (reason) => {
        return Promise.reject(reason);
    });
}

export function searchTestClasses(folderUri: string): Thenable<TestSuite[]> {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_SEARCH_TESTS_IN_FOLDER, folderUri).then((tests: TestSuite[]) => {
        return tests;
    });
}

export function searchPackages(folderUri: string): Thenable<string[]> {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_SEARCH_PACKAGES_IN_FOLDER, folderUri).then((packages: string[]) => {
        return packages;
    });
}

export function searchChildren(testClass: TestSuite): Thenable<TestSuite[]> {
    const serialized: string = JSON.stringify(testClass);
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_SEARCH_TESTS_CHILDREN, serialized).then((tests: TestSuite[]) => {
        tests.forEach((t) => t.parent = testClass);
        testClass.children = tests;
        return tests;
    });
}

function transformIndex(tests: TestSuite[]): void {
    tests.map((t) => {
        if (t.parentIndex !== undefined) {
            t.parent = tests[t.parentIndex];
        }
        if (t.childrenIndices) {
            t.children = t.childrenIndices.map((i) => tests[i]);
        }
    });
}
