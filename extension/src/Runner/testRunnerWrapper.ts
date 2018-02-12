// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ClassPathManager } from "../classPathManager";
import { TestStatusBarProvider } from "../testStatusBarProvider";
import { TestKind, TestLevel, TestResult, TestStatus, TestSuite } from "../Models/protocols";
import * as Logger from "../Utils/Logger/logger";
import { ITestRunner } from "./testRunner";
import { ITestRunnerParameters } from "./testRunnerParameters";
import { JUnitTestRunner } from "./JUnitTestRunner/junitTestRunner";

import { window, EventEmitter } from "vscode";
import { ITestResult } from "./testModel";

export class TestRunnerWrapper {
    public static registerRunner(kind: TestKind, runner: ITestRunner) {
        TestRunnerWrapper.runnerPool.set(kind, runner);
    }

    public static async run(tests: TestSuite[], isDebugMode: boolean): Promise<void> {
        if (TestRunnerWrapper.running) {
            window.showInformationMessage('A test session is currently running. Please wait until it finishes.');
            Logger.info('Skip this run cause we only support running one session at the same time');
            return;
        }
        TestRunnerWrapper.running = true;
        try {
            const runner: ITestRunner = TestRunnerWrapper.getRunner(tests);
            if (runner === null) {
                return undefined;
            }
            await TestStatusBarProvider.getInstance().update(tests, (async () => {
                const params = await runner.setup(tests, isDebugMode);
                const res = await runner.run(params);
                this.updateTestStorage(tests, res);
                runner.postRun();
            })());
        } finally {
            TestRunnerWrapper.running = false;
        }
    }

    private static readonly runnerPool: Map<TestKind, ITestRunner> = new Map<TestKind, ITestRunner>();
    private static running: boolean = false;

    private static getRunner(tests: TestSuite[]): ITestRunner {
        const kind = [...new Set(tests.map((t) => t.kind))];
        if (kind.length > 1) {
            return null;
        }
        if (!TestRunnerWrapper.runnerPool.has(kind[0])) {
            return null;
        }
        return TestRunnerWrapper.runnerPool.get(kind[0]);
    }

    private static updateTestStorage(tests: TestSuite[], result: ITestResult[]): void {
        const mapper = result.reduce((total, cur) => {
            total.set(cur.test, cur.result);
            return total;
        }, new Map<string, TestResult>());
        const classesInflucenced = [];
        const flattenedTests = new Set(tests.map((t) => [t, t.parent, ...(t.children || [])])
                                    .reduce((total, cur) => total.concat(cur), [])
                                    .filter((t) => t));
        flattenedTests.forEach((t) => {
            if (mapper.has(t.test)) {
                t.result = mapper.get(t.test);
            } else if (t.level === TestLevel.Class) {
                classesInflucenced.push(t);
            }
        });
        classesInflucenced.forEach((c) => this.processClass(c));
    }

    private static processClass(t: TestSuite): void {
        let passNum: number = 0;
        let failNum: number = 0;
        let skipNum: number = 0;
        let duration: number = 0;
        let notRun: boolean = false;
        for (const child of t.children) {
            if (!child.result) {
                notRun = true;
                continue;
            }
            duration += Number(child.result.duration);
            switch (child.result.status) {
                case TestStatus.Pass:
                    passNum++;
                    break;
                case TestStatus.Fail:
                    failNum++;
                    break;
                case TestStatus.Skipped:
                    skipNum++;
                    break;
            }
        }

        t.result = {
            status: notRun ? undefined : (skipNum === t.children.length ? TestStatus.Skipped : (failNum > 0 ? TestStatus.Fail : TestStatus.Pass)),
            summary: `Tests run: ${passNum + failNum}, Failures: ${failNum}, Skipped: ${skipNum}.`,
            duration: notRun ? undefined : duration.toString(),
        };
    }
}
