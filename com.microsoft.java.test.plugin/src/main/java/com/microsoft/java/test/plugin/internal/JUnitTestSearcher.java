/*******************************************************************************
 * Copyright (c) 2017 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/
package com.microsoft.java.test.plugin.internal;

import java.lang.reflect.Array;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.core.Flags;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMember;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IPackageFragmentRoot;
import org.eclipse.jdt.core.IRegion;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.ISourceReference;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.ITypeHierarchy;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.search.IJavaSearchConstants;
import org.eclipse.jdt.core.search.IJavaSearchScope;
import org.eclipse.jdt.core.search.SearchEngine;
import org.eclipse.jdt.core.search.SearchMatch;
import org.eclipse.jdt.core.search.SearchParticipant;
import org.eclipse.jdt.core.search.SearchPattern;
import org.eclipse.jdt.core.search.SearchRequestor;
import org.eclipse.jdt.internal.core.ClasspathEntry;
import org.eclipse.jdt.launching.IRuntimeClasspathEntry;
import org.eclipse.jdt.launching.JavaRuntime;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.ResourceUtils;
import org.eclipse.lsp4j.Range;

import com.google.gson.Gson;
import com.microsoft.java.test.plugin.internal.testsuit.TestKind;
import com.microsoft.java.test.plugin.internal.testsuit.TestLevel;
import com.microsoft.java.test.plugin.internal.testsuit.TestSuite;

public abstract class JUnitTestSearcher {
    
    
    public abstract SearchPattern getSearchPattern();
    
    public abstract TestKind getTestKind();
    
    public abstract String getTestMethodAnnotation();

    public void searchAllTests(List<TestSuite> tests, IProgressMonitor monitor) {
        SearchPattern pattern = this.getSearchPattern();
        HashSet<IType> testClasses = new HashSet<>();

        SearchRequestor requestor = new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {

                Object element = match.getElement();
                if (element instanceof IType || element instanceof IMethod) {
                    IMember member = (IMember) element;
                    IType type = member.getElementType() == IJavaElement.TYPE ? (IType) member
                            : member.getDeclaringType();
                    testClasses.add(type);
                }
            }
        };

        try {
            IJavaSearchScope scope = createSearchScope();
            new SearchEngine().search(pattern, new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() },
                    scope, requestor, monitor);
            for (IType type : testClasses) {
                if (JUnitUtility.isAccessibleClass(type) && !Flags.isAbstract(type.getFlags())) {
                    TestSuite parent = getTestSuite(type);
                    tests.add(parent);
                    int parentIndex = tests.size() - 1;
                    int childIndex = parentIndex + 1;
                    List<Integer> children = new ArrayList<>();
                    for (IMethod m : type.getMethods()) {
                        if (JUnitUtility.isTestMethod(m, getTestMethodAnnotation())) {
                            TestSuite child = getTestSuite(m);
                            child.setParent(parentIndex);
                            tests.add(child);
                            children.add(childIndex);
                            childIndex++;
                        }
                    }
                    parent.setChildren(children);
                }
            }
        } catch (CoreException e) {
            // ignore
        }
    }

    public void searchTestsInFolder(List<TestSuite> tests, List<Object> arguments, IProgressMonitor monitor) throws URISyntaxException {
        if (arguments == null || arguments.size() == 0) {
            return;
        }
        SearchPattern pattern = SearchPattern.createPattern("*", IJavaSearchConstants.CLASS, IJavaSearchConstants.DECLARATIONS, SearchPattern.R_PATTERN_MATCH);
        HashSet<IType> testClasses = new HashSet<>();

        SearchRequestor requestor = new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {

                Object element = match.getElement();
                if (element instanceof IType && JUnitUtility.isTestClass((IType)element, getTestMethodAnnotation())) {
                    IType type = (IType) element;
                    testClasses.add(type);
                }
            }
        };

        try {
            URI uri = new URI((String) arguments.get(0));
            IJavaSearchScope scope = createSearchScope(uri);
            new SearchEngine().search(pattern, new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() },
                    scope, requestor, monitor);
            for (IType type : testClasses) {
                if (JUnitUtility.isAccessibleClass(type) && !Flags.isAbstract(type.getFlags())) {
                    TestSuite parent = getTestSuite(type);
                    tests.add(parent);
                }
            }
        } catch (CoreException e) {
            // ignore
        }
    }

    public void searchTestPackages(List<String> packages, List<Object> arguments, IProgressMonitor monitor) throws URISyntaxException, JavaModelException {
        if (arguments == null || arguments.size() == 0) {
            return;
        }
        URI uri = new URI((String) arguments.get(0));
        Set<IJavaProject> projects = ProjectUtils.parseProjects(uri);
        List<IJavaProject> tprojects = new ArrayList<>();
        List<IJavaElement> elements = new ArrayList<>();
        for (IJavaProject project : projects) {
            IClasspathEntry[] entries = project.getRawClasspath();
            List<IPath> testPaths = Arrays.stream(entries).filter(e -> e.isTest() && e.getEntryKind() == ClasspathEntry.CPE_SOURCE)
                                                        .map(e -> e.getPath()).collect(Collectors.toList());
            if (testPaths.size() == 0) {
                continue;
            }
            for (IPackageFragmentRoot root : project.getPackageFragmentRoots()) {
                IResource resource = root.getCorrespondingResource();
                if (resource != null && resource.getType() == IResource.FOLDER) {
                    // add logic to check whether the resource is under test folders.
                    elements.add(root);
                }
            }
        }
        SearchRequestor requestor = new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {

                Object element = match.getElement();
                packages.add((String)element);
            }
        };

        try {
            IJavaSearchScope scope = SearchEngine.createJavaSearchScope(tprojects.toArray(new IJavaProject[tprojects.size()]), IJavaSearchScope.SOURCES);
            SearchPattern pattern = SearchPattern.createPattern("*", IJavaSearchConstants.PACKAGE, IJavaSearchConstants.DECLARATIONS, SearchPattern.R_PATTERN_MATCH);
            new SearchEngine().search(pattern, new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() },
                    scope, requestor, monitor);
        } catch (CoreException e) {
            // ignore
        }
    }

    public void searchTestChildren(List<TestSuite> tests, List<Object> arguments, IProgressMonitor monitor) throws URISyntaxException {
        if (arguments == null || arguments.size() == 0) {
            return;
        }
        SearchPattern pattern = this.getSearchPattern();
        HashSet<IMember> elements = new HashSet<>();

        SearchRequestor requestor = new SearchRequestor() {
            @Override
            public void acceptSearchMatch(SearchMatch match) throws CoreException {

                Object element = match.getElement();
                if (element instanceof IType || element instanceof IMethod) {
                    elements.add((IMember)element);
                }
            }
        };

        try {
            Gson json = new Gson();
            TestSuite parent = json.fromJson((String) arguments.get(0), TestSuite.class);
            IJavaSearchScope scope = createHierarchyScope(parent);
            new SearchEngine().search(pattern, new SearchParticipant[] { SearchEngine.getDefaultSearchParticipant() },
                    scope, requestor, monitor);
            for (IMember element : elements) {
                if (element instanceof IType) {
                    IType type = (IType)element;
                    String name = type.getFullyQualifiedName();
                    if (!name.equals(parent.getTest()) && JUnitUtility.isAccessibleClass(type) && !Flags.isAbstract(type.getFlags())) {
                        tests.add(getTestSuite(type));
                    }
                } else {
                    IMethod m = (IMethod)element;
                    if (JUnitUtility.isTestMethod(m, getTestMethodAnnotation())) {
                        TestSuite child = getTestSuite(m);
                        tests.add(child);
                    }
                }
            }
        } catch (CoreException e) {
            // ignore
        }
    }

    private static IJavaSearchScope createSearchScope() throws JavaModelException {
        IJavaProject[] projects = JavaCore.create(ResourcesPlugin.getWorkspace().getRoot()).getJavaProjects();
        return SearchEngine.createJavaSearchScope(projects, IJavaSearchScope.SOURCES);
    }

    private static IJavaSearchScope createSearchScope(URI folderUri) throws JavaModelException {
        Set<IJavaProject> set = ProjectUtils.parseProjects(folderUri);
        IJavaProject[] projects = set.toArray(new IJavaProject[set.size()]);
        return SearchEngine.createJavaSearchScope(projects, IJavaSearchScope.SOURCES);
    }

    private static IJavaSearchScope createHierarchyScope(TestSuite parent) throws JavaModelException, URISyntaxException {
        String uri = parent.getUri();
        final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(uri);
        if (unit == null || !unit.getResource().exists()) {
            return createSearchScope(new URI(uri));
        }
        IJavaElement[] elements = unit.getChildren();
        List<IJavaElement> types = Arrays.stream(elements)
                .filter(e -> e.getElementType() == IJavaElement.TYPE && parent.getTest().endsWith(e.getElementName()))
                .collect(Collectors.toList());
        if (types.size() == 0) {
            return createSearchScope(new URI(uri));
        }
        return SearchEngine.createHierarchyScope((IType)types.get(0));
    }

    private TestSuite getTestSuite(IMember member) throws JavaModelException {
        ICompilationUnit unit = member.getCompilationUnit();
        String uri = ResourceUtils.toClientUri(JDTUtils.toUri(unit));
        String project = unit.getJavaProject().getProject().getName();
        if (member.getElementType() == IJavaElement.TYPE) {
            IType type = (IType) member;
            return new TestSuite(getRange(unit, member), uri, type.getFullyQualifiedName(),
                    type.getPackageFragment().getElementName(), TestLevel.Class, this.getTestKind(), project);
        } else {
            IType type = ((IMethod) member).getDeclaringType();
            return new TestSuite(getRange(unit, member), uri,
                    type.getFullyQualifiedName() + "#" + member.getElementName(),
                    type.getPackageFragment().getElementName(), TestLevel.Method, this.getTestKind(), project);
        }
    }

    private Range getRange(ICompilationUnit typeRoot, IJavaElement element) throws JavaModelException {
        ISourceRange r = ((ISourceReference) element).getNameRange();
        return JDTUtils.toRange(typeRoot, r.getOffset(), r.getLength());
    }
}
