/*
 * Copyright (c) 2012-2017 Red Hat, Inc.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */
package com.microsoft.java.test.runner;

import java.io.PrintStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.StringJoiner;

import org.junit.runner.Description;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;

public class TestingMessageHelper {
    /**
     * Prints a message when the test reported was attached.
     *
     * @param out output stream
     */
    public static void reporterAttached(PrintStream out) {
        out.println(create(TestMessageConstants.TEST_REPORTER_ATTACHED, TestMessageType.Info, (List<Pair>) null));
    }

    /**
     * Prints an information about the root test execution.
     *
     * @param out output stream
     */
    public static void rootPresentation(PrintStream out) {
        out.println(create(TestMessageConstants.ROOT_NAME, TestMessageType.Info, new Pair(TestMessageConstants.NAME, "Default Suite")));
    }

    /**
     * Prints an information when an atomic test is about to be started.
     *
     * @param description information about test
     * @param out output stream
     */
    public static void testStarted(PrintStream out, Description description) {
        String location = description.getClassName() + "." + description.getMethodName();
        out.println(
                create(
                        TestMessageConstants.TEST_STARTED,
                        TestMessageType.Info,
                        new Pair(TestMessageConstants.NAME, description.getMethodName()),
                        new Pair(TestMessageConstants.LOCATION, "java:test://" + location)));
    }

    /**
     * Prints an information when a test will not be run.
     *
     * @param name method name
     * @param out output stream
     */
    public static void testIgnored(PrintStream out, String name) {
        out.println(create(TestMessageConstants.TEST_IGNORED, TestMessageType.Info, new Pair(TestMessageConstants.NAME, name)));
    }

    /**
     * Prints an information when an atomic test has finished.
     *
     * @param description information about test method
     * @param out output stream
     * @param duration time of test running
     */
    public static void testFinished(PrintStream out, Description description, long duration) {
        out.println(
                create(
                        TestMessageConstants.TEST_FINISHED,
                        TestMessageType.Info,
                        new Pair(TestMessageConstants.NAME, description.getMethodName()),
                        new Pair(TestMessageConstants.DURATION, String.valueOf(duration))));
    }

    /**
     * Prints an information when an test node has added.
     *
     * @param description information about test node
     * @param out output stream
     */
    public static void treeNode(PrintStream out, Description description) {
        String location = description.getClassName() + "." + description.getMethodName();
        out.println(
                create(
                        TestMessageConstants.SUITE_TREE_NODE,
                        TestMessageType.Info,
                        new Pair(TestMessageConstants.NAME, description.getMethodName()),
                        new Pair(TestMessageConstants.LOCATION, "java:test://" + location)));
    }

    /**
     * Prints an information when running of test suite started.
     *
     * @param currentSuite name of test suite
     * @param out output stream
     */
    public static void testSuiteFinished(PrintStream out, String currentSuite) {
        out.println(create(TestMessageConstants.TEST_SUITE_FINISHED, TestMessageType.Info, new Pair(TestMessageConstants.NAME, currentSuite)));
    }

    /**
     * Prints an information when running of test suite started.
     *
     * @param description information about suite
     * @param out output stream
     */
    public static void testSuiteStarted(PrintStream out, Description description) {
        out.println(
                create(
                        TestMessageConstants.TEST_SUITE_STARTED,
                        TestMessageType.Info,
                        new Pair(TestMessageConstants.NAME, description.getClassName()),
                        new Pair(TestMessageConstants.LOCATION, "java:test://" + description.getClassName())));
    }

    /**
     * Prints an information when building of test tree started.
     *
     * @param description information about suite
     * @param out output stream
     */
    public static void suiteTreeNodeStarted(PrintStream out, Description description) {
        out.println(
                create(
                        TestMessageConstants.SUITE_TREE_STARTED,
                        TestMessageType.Info,
                        new Pair(TestMessageConstants.NAME, description.getClassName()),
                        new Pair(TestMessageConstants.LOCATION, "java:test://" + description.getClassName())));
    }

    /**
     * Prints an information when building of test tree ended.
     *
     * @param description information about suite
     * @param out output stream
     */
    public static void suiteTreeNodeEnded(PrintStream out, Description description) {
        out.println(
                create(
                        TestMessageConstants.SUITE_TREE_ENDED,
                        TestMessageType.Info,
                        new Pair(TestMessageConstants.NAME, description.getClassName()),
                        new Pair(TestMessageConstants.LOCATION, "java:test://" + description.getClassName())));
    }

    /**
     * Prints an information when a test fails.
     *
     * @param out output stream
     * @param failure describes the test that failed and the exception that was thrown
     * @param duration time of test running
     */
    public static void testFailed(PrintStream out, Failure failure, long duration) {
        List<Pair> attributes = new ArrayList<>();
        attributes.add(new Pair(TestMessageConstants.NAME, failure.getDescription().getMethodName()));
        Throwable exception = failure.getException();
        if (exception != null) {
            String failMessage = failure.getMessage();
            StringWriter writer = new StringWriter();
            PrintWriter printWriter = new PrintWriter(writer);
            exception.printStackTrace(printWriter);
            String stackTrace = writer.getBuffer().toString();
            attributes.add(new Pair(TestMessageConstants.MESSAGE, failMessage));
            attributes.add(new Pair(TestMessageConstants.DETAILS, stackTrace));
        } else {
            attributes.add(new Pair(TestMessageConstants.MESSAGE, ""));
        }
        attributes.add(new Pair(TestMessageConstants.DURATION, String.valueOf(duration)));

        out.println(create(TestMessageConstants.TEST_FAILED, TestMessageType.Info, attributes));
    }

    /**
     * Prints an information about result of the test running.
     *
     * @param out output stream
     * @param result the summary of the test run, including all the tests that failed
     */
    public static void testRunFinished(PrintStream out, Result result) {
        String summary = String.format("Total tests run: %d, Failures: %d, Skips: %d",
                result.getRunCount(), result.getFailureCount(), result.getIgnoreCount());
        out.println(create(
                TestMessageConstants.TEST_RESULT_SUMMARY,
                TestMessageType.Info,
                new Pair(TestMessageConstants.MESSAGE, summary)));
    }

    public static String create(String name, TestMessageType type, Pair... attributes) {
        List<Pair> pairList = null;
        if (attributes != null) {
            pairList = Arrays.asList(attributes);
        }
        return create(name, type, pairList);
    }

    public static String createRunnerError(String message, Throwable e) {
        return create(
                TestMessageConstants.TEST_RUNNER_ERROR,
                TestMessageType.Error,
                new Pair(TestMessageConstants.MESSAGE, message),
                new Pair(TestMessageConstants.DETAILS, getStacktrace(e)));
    }

    public static String create(String name, TestMessageType type, List<Pair> attributes) {
        StringBuilder builder = new StringBuilder("@@<TestRunner-{\"name\":");
        builder.append('"').append(name).append('"');
        builder.append(", \"type\":").append('"').append(type).append('"');
        if (attributes != null) {
            builder.append(", \"attributes\":{");
            StringJoiner joiner = new StringJoiner(", ");
            for (Pair attribute : attributes) {
                joiner.add("\"" + attribute.first + "\":\"" + escape(attribute.second) + "\"");
            }
            builder.append(joiner.toString());
            builder.append("}");
        }

        builder.append("}-TestRunner>");
        return builder.toString();
    }

    private static String escape(String str) {
    	if (str == null) {
    		return str;
    	}
        int len = str.length();
        StringBuilder sb = new StringBuilder(len);
        String t;
        for (int i = 0; i < len; i += 1) {
            char c = str.charAt(i);
            switch (c) {
            case '\\':
            case '\"':
                sb.append('\\');
                sb.append(c);
                break;
            case '\b':
                sb.append("\\b");
                break;
            case '\t':
                sb.append("\\t");
                break;
            case '\n':
                sb.append("\\n");
                break;
            case '\f':
                sb.append("\\f");
                break;
            case '\r':
               sb.append("\\r");
               break;
            case '@':
               sb.append("&#x40;");
               break;
            default:
                if (c < ' ') {
                    t = "000" + Integer.toHexString(c);
                    sb.append("\\u" + t.substring(t.length() - 4));
                } else {
                    sb.append(c);
                }
            }
        }
        return sb.toString();
    }

    private static String getStacktrace(Throwable e) {
        if (e == null) {
            return null;
        }
        StringWriter errors = new StringWriter();
        e.printStackTrace(new PrintWriter(errors));
        return errors.toString();
    }
}
