// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { TestLevel, TestResult, TestStatus } from "../../Models/protocols";
import * as Logger from "../../Utils/Logger/logger";
import { ITestInfo, ITestResult } from "../testModel";
import { JarFileRunnerResultAnalyzer } from "../JarFileRunner/jarFileRunnerResultAnalyzer";

const SUITE_START: string = 'testSuiteStarted';
const SUITE_FINISH: string = 'testSuiteFinished';
const TEST_START: string = 'testStarted';
const TEST_FAIL: string = 'testFailed';
const TEST_FINISH: string = 'testFinished';

export class JUnitRunnerResultAnalyzer extends JarFileRunnerResultAnalyzer {
    private _suiteName: string;

    public analyzeData(data: string): void {
        const regex = /@@<([^@]*)>/gm;
        let match;
        do {
            match = regex.exec(data);
            if (match) {
                try {
                    this.analyzeDataCore(match[1]);
                } catch (ex) {
                    Logger.error(`Failed to analyze runner output data. Data: ${match[1]}.`, {
                        error: ex,
                    });
                }
            }
        } while (match);
    }

    public feedBack(): ITestResult[] {
        const toAggregate = new Set();
        const result: ITestResult[] = [];
        this._tests.forEach((t) => {
            if (t.level === TestLevel.Class) {
                t.children.forEach((c) => this.processMethod(c, result));
            } else {
                this.processMethod(t, result);
            }
        });
        return result;
    }

    private analyzeDataCore(match: string) {
        let res;
        const info = JSON.parse(match) as JUnitTestResultInfo;
        switch (info.name) {
            case SUITE_START :
                this._suiteName = info.attributes.name;
                break;
            case SUITE_FINISH:
                this._suiteName = undefined;
                break;
            case TEST_START:
                this._testResults.set(this._suiteName + "#" + info.attributes.name, {
                    status: undefined,
                });
                break;
            case TEST_FAIL:
                res = this._testResults.get(this._suiteName + "#" + info.attributes.name);
                if (!res) {
                    return;
                }
                res.status = TestStatus.Fail;
                res.message = info.attributes.message;
                res.details = info.attributes.details;
                break;
            case TEST_FINISH:
                res = this._testResults.get(this._suiteName + "#" + info.attributes.name);
                if (!res) {
                    return;
                }
                if (!res.status) {
                    res.status = TestStatus.Pass;
                }
                res.duration = info.attributes.duration;
                break;
        }
    }

    private processMethod(t: ITestInfo, result: ITestResult[]): void {
        if (!this._testResults.has(t.test)) {
            this._testResults.set(t.test, {
                status: TestStatus.Skipped,
            });
        }
        result.push({
            test: t.test,
            uri: t.uri,
            result: this._testResults.get(t.test),
        });
    }
}

export type JUnitTestResultInfo = {
    name: string;
    attributes: JUnitTestAttributes;
};

export type JUnitTestAttributes = {
    name: string;
    duration: string;
    location: string;
    message: string;
    details: string;
};
