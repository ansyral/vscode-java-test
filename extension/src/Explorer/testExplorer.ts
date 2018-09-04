// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
// tslint:disable-next-line
import { window, workspace, Event, EventEmitter, ExtensionContext, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, ViewColumn, Command } from 'vscode';
import { TestResourceManager } from '../testResourceManager';
import { TestStatusBarProvider } from '../testStatusBarProvider';
import * as Commands from '../Constants/commands';
import { TestLevel, TestSuite } from '../Models/protocols';
import { RunConfigItem } from '../Models/testConfig';
import { TestRunnerWrapper } from '../Runner/testRunnerWrapper';
import * as FetchTestsUtility from '../Utils/fetchTestUtility';
import { TestTreeNode, TestTreeNodeType } from './testTreeNode';

export class TestExplorer implements TreeDataProvider<TestTreeNode> {
    private static statusBarItem: TestStatusBarProvider = TestStatusBarProvider.getInstance();
    private _onDidChangeTreeData: EventEmitter<TestTreeNode | undefined> = new EventEmitter<TestTreeNode | undefined>();
    // tslint:disable-next-line
    public readonly onDidChangeTreeData: Event<TestTreeNode | null> = this._onDidChangeTreeData.event;

    constructor(
        private _context: ExtensionContext,
        private _testCollectionStorage: TestResourceManager) {
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: TestTreeNode): TreeItem {
        return {
            label: this.getFriendlyElementName(element),
            collapsibleState: element.isFolder ? TreeItemCollapsibleState.Collapsed : void 0,
            command: this.getCommand(element),
            iconPath: this.getIconPath(element),
            contextValue: element.level.toString(),
        };
    }

    public getChildren(element?: TestTreeNode): TestTreeNode[] | Thenable<TestTreeNode[]> {
        const config = workspace.getConfiguration();
        const loadType: string = config.get<string>('java.test.explorer.load', 'lazy');
        if (loadType === 'lazy') {
            return this.getChildren_lazyLoad(element);
        } else {
            return this.getChildren_loadAll(element);
        }
    }

    public select(element: TestTreeNode) {
        const editor = window.activeTextEditor;
        const uri = Uri.parse(element.uri);
        workspace.openTextDocument(uri).then((doc) => {
            return window.showTextDocument(doc, {
                    preserveFocus: true,
                    selection: element.range,
                });
        });
    }

    public run(element: TestTreeNode, debugMode: boolean, config?: RunConfigItem) {
        return TestRunnerWrapper.run(this.resolveTestSuites(element), debugMode, config);
    }

    public resolveTestSuites(element: TestTreeNode): TestSuite[] {
        if (!element) {
            return (this.getChildren(element) as TestTreeNode[]).map((f) => this.resolveTestSuites(f)).reduce((a, b) => a.concat(b));
        }
        if (element.level === TestTreeNodeType.Class || element.level === TestTreeNodeType.Method) {
            return[this.toTestSuite(element)];
        }
        return element.children.map((c) => this.resolveTestSuites(c)).reduce((a, b) => a.concat(b));
    }

    private async getChildren_loadAll(element?: TestTreeNode): Promise<TestTreeNode[]> {
        if (element) {
            return element.children;
        }
        await TestExplorer.statusBarItem.init(this._testCollectionStorage.refresh());
        const tests: TestSuite[] = this._testCollectionStorage.getAll().filter((t) => t.level === TestLevel.Method);
        return this.createTestTreeNode(tests, undefined, TestTreeNodeType.Folder);
    }

    private async getChildren_lazyLoad(element?: TestTreeNode): Promise<TestTreeNode[]> {
        if (!element) { // root layer
            const folders = workspace.workspaceFolders;
            return folders.map((f) =>
            new TestTreeNode(path.basename(f.uri.path), f.uri.toString(), undefined, undefined, undefined, TestTreeNodeType.Folder));
        }
        if (!element.children) {
            switch (element.level) {
                case TestTreeNodeType.Folder:
                /* await FetchTestsUtility.searchTestClasses(element.uri).then((tests: TestSuite[]) => {
                    this.updateTestStorage(tests);
                    element.children = this.createTestTreeNode(tests, element, TestTreeNodeType.Package, TestTreeNodeType.Class);
                }); */
                await FetchTestsUtility.searchPackages(element.uri).then((packages: string[]) => {
                    element.children = packages.map((p) => new TestTreeNode(p, undefined, undefined, element, undefined, TestTreeNodeType.Package));
                });
                break;
                case TestTreeNodeType.Class:
                await FetchTestsUtility.searchChildren(this.toTestSuite(element)).then((tests: TestSuite[]) => {
                    this.updateTestStorage(tests);
                    element.children = tests.map((t) =>
                                                new TestTreeNode(this.getShortName(t), t.uri, t.range, element, undefined));
                });
                break;
            }
        }
        return element.children;
    }

    private updateTestStorage(tests: TestSuite[]) {
        if (!tests || tests.length === 0) {
            return;
        }
        const groupByDocument = tests.reduce((rv, x) => {
            if (!rv[x.uri]) {
                rv[x.uri] = [];
            }
            rv[x.uri].push(x);
            return rv;
        }, {});
        for (const uri of Object.keys(groupByDocument)) {
            this._testCollectionStorage.storeTests(Uri.parse(uri), groupByDocument[uri], false);
        }
    }

    private createTestTreeNode(
        tests: TestSuite[],
        parent: TestTreeNode,
        level: TestTreeNodeType,
        terminateLevel: TestTreeNodeType = TestTreeNodeType.Method): TestTreeNode[] {
        if (level === terminateLevel) {
            if (level === TestTreeNodeType.Method) {
                return tests.map((t) => new TestTreeNode(this.getShortName(t), t.uri, t.range, parent, undefined));
            } else if (level === TestTreeNodeType.Class) {
                return tests.map((t) => new TestTreeNode(this.getShortName(t), t.uri, undefined, parent, undefined, TestTreeNodeType.Class));
            }
        }
        const keyFunc: (_: TestSuite) => string = this.getGroupKeyFunc(level);
        const map = new Map<string, TestSuite[]>();
        tests.forEach((t) => {
            const key = keyFunc(t);
            const collection: TestSuite[] = map.get(key);
            if (!collection) {
                map.set(key, [t]);
            } else {
                collection.push(t);
            }
        });
        const children = [...map.entries()].map((value) => {
            const uri: string = level === TestTreeNodeType.Class ? value[1][0].uri : undefined;
            const c: TestTreeNode = new TestTreeNode(value[0], uri, undefined, parent, undefined, level);
            c.children = this.createTestTreeNode(value[1], c, level - 1, terminateLevel);
            return c;
        });
        return children;
    }

    private getGroupKeyFunc(level: TestTreeNodeType): ((_: TestSuite) => string) {
        switch (level) {
            case TestTreeNodeType.Folder:
                return (_) => this.getWorkspaceFolder(_);
            case TestTreeNodeType.Package:
                return (_) => _.packageName;
            case TestTreeNodeType.Class:
                return (_) => this.getShortName(_.parent);
            default:
                throw new Error('Not supported group level');
        }
    }

    private getWorkspaceFolder(test: TestSuite): string {
        const folders = workspace.workspaceFolders;
        return folders.filter((f) => {
            const fp = Uri.parse(test.uri).fsPath;
            return fp.startsWith(f.uri.fsPath);
        }).map((f) => path.basename(f.uri.path))[0];
    }

    private getShortName(test: TestSuite): string {
        if (test.level === TestLevel.Method) {
            return test.test.substring(test.test.indexOf('#') + 1);
        } else {
            return test.test.substring(test.packageName === '' ? 0 : test.packageName.length + 1);
        }
    }

    private getFriendlyElementName(element: TestTreeNode): string {
        if (element.level === TestTreeNodeType.Package && element.name === '') {
            return '(default package)';
        }
        return element.name;
    }

    private getIconPath(element: TestTreeNode): string | Uri | {dark: string | Uri, light: string | Uri} {
        switch (element.level) {
            case TestTreeNodeType.Method:
            return {
                dark: this._context.asAbsolutePath(path.join('resources', 'media', 'dark', 'method.svg')),
                light: this._context.asAbsolutePath(path.join('resources', 'media', 'light', 'method.svg')),
            };
            case TestTreeNodeType.Class:
            return {
                dark: this._context.asAbsolutePath(path.join('resources', 'media', 'dark', 'class.svg')),
                light: this._context.asAbsolutePath(path.join('resources', 'media', 'light', 'class.svg')),
            };
            case TestTreeNodeType.Package:
            return {
                dark: this._context.asAbsolutePath(path.join('resources', 'media', 'dark', 'package.svg')),
                light: this._context.asAbsolutePath(path.join('resources', 'media', 'light', 'package.svg')),
            };
            default:
            return undefined;
        }
    }

    private getCommand(element: TestTreeNode): Command | undefined {
        if (element.level <= TestTreeNodeType.Class) {
            return {
                command: Commands.JAVA_TEST_EXPLORER_SELECT,
                title: '',
                arguments: [element],
            };
        }
        return undefined;
    }

    private toTestSuite(element: TestTreeNode): TestSuite {
        const uri: Uri = Uri.parse(element.uri);
        const tests: TestSuite[] = this._testCollectionStorage.getTests(uri).tests;
        return tests.filter((t) => t.test === element.fullName)[0];
    }
}
