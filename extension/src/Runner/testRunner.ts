// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ITestInfo, ITestResult } from "./testModel";
import { ITestRunnerParameters } from "./testRunnerParameters";

export interface ITestRunner {
    setup(tests: ITestInfo[], isDebugMode: boolean): Promise<ITestRunnerParameters>;
    run(params: ITestRunnerParameters): Promise<ITestResult[]>;
}
