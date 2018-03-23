// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export type TestConfig = {
    run: RunConfig;
    debug: RunConfig;
};

export type RunConfig = {
    projectName: string;
    workingDirectory: string;
    args: any[];
    vmargs: any[];
    preLaunchTask: string;
};
