package com.microsoft.java.test.plugin.internal;

public class ProjectInfo {
    private String path;
    private String name;
    public String getPath() {
        return path;
    }
    public void setPath(String path) {
        this.path = path;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    
    public ProjectInfo(String path, String name) {
        this.path = path;
        this.name = name;
    }
}
