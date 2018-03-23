// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { workspace, Uri } from 'vscode';

import { ProjectManager } from '../projectManager';
import { TestSuite } from '../Models/protocols';
import { TestConfig } from '../Models/testConfig';

export function createDefaultTestConfig(test: TestSuite, projectManager: ProjectManager): TestConfig {
    const uri: Uri = Uri.parse(test.uri);
    const projectName: string = projectManager.getProjectName(uri);
    const workingDirectory: string = workspace.getWorkspaceFolder(uri).uri.fsPath;
    const config: TestConfig = {
        run: {
            projectName,
            workingDirectory,
            args: [],
            vmargs: [],
            preLaunchTask: '',
        },
        debug: {
            projectName,
            workingDirectory,
            args: [],
            vmargs: [],
            preLaunchTask: '',
        },
    };
    return config;
}
