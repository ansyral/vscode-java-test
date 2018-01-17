// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ClassPathManager } from "../classPathManager";
import { Logger } from "../logger";
import { TestKind, TestSuite } from "../protocols";
import { JUnitTestRunner } from "./junitTestRunner";
import { ITestRunner } from "./testRunner";
import { ITestRunnerContext } from "./testRunnerContext";

import { window, EventEmitter } from "vscode";

export class TestRunnerWrapper {
    public static InitializeRunnerPool(
        javaHome: string, storagePath: string, classPathManager: ClassPathManager, onDidChange: EventEmitter<void>, logger: Logger): void {
        TestRunnerWrapper.runnerPool.set(TestKind.JUnit, new JUnitTestRunner(javaHome, storagePath, classPathManager, onDidChange, logger));
        TestRunnerWrapper.logger = logger;
    }

    public static async run(context: ITestRunnerContext): undefined | Promise<undefined> {
        if (TestRunnerWrapper.running) {
            window.showInformationMessage('A test session is currently running. Please wait until it finishes.');
            TestRunnerWrapper.logger.logInfo('Skip this run cause we only support running one session at the same time');
            return;
        }
        TestRunnerWrapper.running = true;
        try {
            const runner: ITestRunner = TestRunnerWrapper.getRunner(context.tests);
            if (runner === null) {
                return undefined;
            }
            const res = await runner.run(context);
            return res;
        } finally {
            TestRunnerWrapper.running = false;
        }
    }

    private static readonly runnerPool: Map<TestKind, ITestRunner> = new Map<TestKind, ITestRunner>();
    private static running: boolean = false;
    private static logger: Logger;

    private static getRunner(tests: TestSuite[]): ITestRunner {
        const kind = [...new Set(tests.map((t) => t.kind))];
        if (kind.length > 1) {
            return null;
        }
        // remove the hack later
        if (kind[0] === undefined) {
            kind[0] = TestKind.JUnit;
        }
        if (!TestRunnerWrapper.runnerPool.has(kind[0])) {
            return null;
        }
        return TestRunnerWrapper.runnerPool.get(kind[0]);
    }
}
