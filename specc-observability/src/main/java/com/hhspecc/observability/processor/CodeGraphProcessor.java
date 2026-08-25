package com.hhspecc.observability.processor;

import com.sun.source.util.Trees;

import javax.annotation.processing.AbstractProcessor;
import javax.annotation.processing.ProcessingEnvironment;
import javax.annotation.processing.RoundEnvironment;
import javax.annotation.processing.SupportedAnnotationTypes;
import javax.annotation.processing.SupportedOptions;
import javax.annotation.processing.SupportedSourceVersion;
import javax.lang.model.SourceVersion;
import javax.lang.model.element.AnnotationMirror;
import javax.lang.model.element.AnnotationValue;
import javax.lang.model.element.Element;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.VariableElement;
import java.io.IOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * 编译期 DAG 处理器：扫描 {@code Capability}/{@code CapabilityPoint}/{@code Orchestrate}
 * 三个 SOURCE 保留策略的注解，生成 code-graph.json 与 code-graph.mmd。
 *
 * <p>关键设计：处理器只在「编译期」运行，业务代码运行时完全不加载本类，
 * 因此可观测性对业务性能零影响；DAG 与代码同源（注解贴在代码上），天然不漂移。</p>
 *
 * <p>输出目录通过 {@code -AcodeGraphOutputDir=<path>} 指定，缺省写回
 * {@code CLASS_OUTPUT}（即 target/classes）。</p>
 */
@SupportedAnnotationTypes({
        "com.hhspecc.observability.Capability",
        "com.hhspecc.observability.CapabilityPoint",
        "com.hhspecc.observability.Orchestrate"
})
@SupportedOptions({"codeGraphOutputDir", "codeGraphFeature"})
@SupportedSourceVersion(SourceVersion.RELEASE_17)
public class CodeGraphProcessor extends AbstractProcessor {

    private static final String ANNOTATION_CAPABILITY = "com.hhspecc.observability.Capability";
    private static final String ANNOTATION_POINT = "com.hhspecc.observability.CapabilityPoint";
    private static final String ANNOTATION_ORCHESTRATE = "com.hhspecc.observability.Orchestrate";

    private final Map<String, Map<String, String>> capabilities = new TreeMap<>();
    private final List<Map<String, String>> points = new ArrayList<>();
    private final List<Map<String, String>> edges = new ArrayList<>();
    private boolean emitted = false;
    private Trees trees;

    @Override
    public synchronized void init(ProcessingEnvironment processingEnv) {
        super.init(processingEnv);
        this.trees = Trees.instance(processingEnv);
    }

    @Override
    public boolean process(Set<? extends TypeElement> annotations, RoundEnvironment roundEnv) {
        if (roundEnv.processingOver()) {
            if (!emitted) {
                emit();
                emitted = true;
            }
            return false;
        }
        collectCapabilities(roundEnv);
        collectPoints(roundEnv);
        collectEdges(roundEnv);
        return false;
    }

    private void collectCapabilities(RoundEnvironment roundEnv) {
        for (Element element : roundEnv.getElementsAnnotatedWith(processingEnv
                .getElementUtils().getTypeElement(ANNOTATION_CAPABILITY))) {
            Map<String, String> values = readAnnotationValues(element, ANNOTATION_CAPABILITY);
            if (values == null) {
                continue;
            }
            Map<String, String> node = new LinkedHashMap<>();
            node.put("id", values.getOrDefault("req", ""));
            node.put("type", "capability");
            node.put("name", values.getOrDefault("name", ""));
            node.put("file", sourceFileOf(element));
            capabilities.put(values.getOrDefault("req", ""), node);
        }
    }

    private void collectPoints(RoundEnvironment roundEnv) {
        for (Element element : roundEnv.getElementsAnnotatedWith(processingEnv
                .getElementUtils().getTypeElement(ANNOTATION_POINT))) {
            Map<String, String> values = readAnnotationValues(element, ANNOTATION_POINT);
            if (values == null) {
                continue;
            }
            Map<String, String> node = new LinkedHashMap<>();
            node.put("id", values.getOrDefault("task", ""));
            node.put("type", "capabilityPoint");
            node.put("name", values.getOrDefault("name", ""));
            node.put("capability", capabilityOf(element));
            node.put("file", sourceFileOf(element));
            points.add(node);
        }
    }

    private void collectEdges(RoundEnvironment roundEnv) {
        for (Element element : roundEnv.getElementsAnnotatedWith(processingEnv
                .getElementUtils().getTypeElement(ANNOTATION_ORCHESTRATE))) {
            Map<String, String> values = readAnnotationValues(element, ANNOTATION_ORCHESTRATE);
            if (values == null) {
                continue;
            }
            Map<String, String> edge = new LinkedHashMap<>();
            edge.put("from", values.getOrDefault("from", ""));
            edge.put("to", values.getOrDefault("to", ""));
            edge.put("rel", values.getOrDefault("rel", "calls"));
            edges.add(edge);
        }
    }

    private String capabilityOf(Element methodElement) {
        Element enclosing = methodElement.getEnclosingElement();
        if (enclosing instanceof TypeElement) {
            Map<String, String> values = readAnnotationValues(enclosing, ANNOTATION_CAPABILITY);
            if (values != null) {
                return values.getOrDefault("req", "");
            }
        }
        return "";
    }

    private String sourceFileOf(Element element) {
        try {
            return trees.getPath(element).getCompilationUnit().getSourceFile().getName();
        } catch (Exception ignored) {
            return "";
        }
    }

    /**
     * 读取注解成员值，返回「成员名 -> 字符串值」的映射；注解不存在时返回 null。
     * 使用 AnnotationMirror 而非反射，适配 SOURCE 保留策略的注解。
     */
    private Map<String, String> readAnnotationValues(Element element, String annotationName) {
        for (AnnotationMirror mirror : element.getAnnotationMirrors()) {
            Element annotationElement = mirror.getAnnotationType().asElement();
            if (!annotationElement.toString().equals(annotationName)) {
                continue;
            }
            Map<String, String> values = new HashMap<>();
            for (Map.Entry<? extends ExecutableElement, ? extends AnnotationValue> entry
                    : mirror.getElementValues().entrySet()) {
                String key = entry.getKey().getSimpleName().toString();
                values.put(key, String.valueOf(entry.getValue().getValue()));
            }
            return values;
        }
        return null;
    }

    private void emit() {
        Path outputDir = resolveOutputDir();
        try {
            Files.createDirectories(outputDir);
            writeJson(outputDir.resolve("code-graph.json"));
            writeMermaid(outputDir.resolve("code-graph.mmd"));
            processingEnv.getMessager().printMessage(
                    javax.tools.Diagnostic.Kind.NOTE,
                    "hh-specc 可观测 DAG 已生成：" + outputDir.toAbsolutePath());
        } catch (IOException e) {
            processingEnv.getMessager().printMessage(
                    javax.tools.Diagnostic.Kind.ERROR,
                    "生成 code-graph 失败：" + e.getMessage());
        }
    }

    private Path resolveOutputDir() {
        String dir = processingEnv.getOptions().get("codeGraphOutputDir");
        if (dir != null && !dir.isBlank()) {
            return Paths.get(dir);
        }
        try {
            return Paths.get(processingEnv.getFiler()
                    .createResource(javax.tools.StandardLocation.CLASS_OUTPUT, "", "dummy")
                    .toUri()).getParent();
        } catch (IOException ignored) {
            return Paths.get("target");
        }
    }

    private void writeJson(Path file) throws IOException {
        String feature = processingEnv.getOptions().getOrDefault("codeGraphFeature", "");
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"feature\": \"").append(escape(feature)).append("\",\n");
        sb.append("  \"generatedAt\": \"").append(Instant.now()).append("\",\n");
        sb.append("  \"nodes\": [\n");
        boolean first = true;
        for (Map<String, String> node : capabilities.values()) {
            appendJsonObject(sb, node, first);
            first = false;
        }
        for (Map<String, String> node : points) {
            appendJsonObject(sb, node, first);
            first = false;
        }
        sb.append("\n  ],\n");
        sb.append("  \"edges\": [\n");
        first = true;
        for (Map<String, String> edge : edges) {
            appendJsonObject(sb, edge, first);
            first = false;
        }
        sb.append("\n  ]\n");
        sb.append("}\n");
        try (Writer writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8)) {
            writer.write(sb.toString());
        }
    }

    private void appendJsonObject(StringBuilder sb, Map<String, String> obj, boolean first) {
        sb.append(first ? "    " : ",\n    ").append("{");
        boolean firstField = true;
        for (Map.Entry<String, String> entry : obj.entrySet()) {
            if (!firstField) {
                sb.append(", ");
            }
            sb.append("\"").append(escape(entry.getKey())).append("\": \"")
                    .append(escape(entry.getValue())).append("\"");
            firstField = false;
        }
        sb.append("}");
    }

    private void writeMermaid(Path file) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("%% hh-specc 可观测 DAG（由编译期注解处理器生成，勿手改）\n");
        sb.append("graph TD\n");
        for (Map<String, String> node : capabilities.values()) {
            sb.append("  ").append(node.get("id"))
                    .append("[\"").append(node.get("name"))
                    .append("<br/>").append(node.get("id"))
                    .append(" · capability\"]\n");
        }
        for (Map<String, String> node : points) {
            sb.append("  ").append(node.get("id"))
                    .append("[\"").append(node.get("name"))
                    .append("<br/>").append(node.get("id"))
                    .append(" · capabilityPoint\"]\n");
        }
        for (Map<String, String> node : points) {
            String capability = node.getOrDefault("capability", "");
            if (!capability.isEmpty() && capabilities.containsKey(capability)) {
                sb.append("  ").append(capability).append(" --> ").append(node.get("id")).append("\n");
            }
        }
        for (Map<String, String> edge : edges) {
            sb.append("  ").append(edge.get("from")).append(" -->|")
                    .append(edge.getOrDefault("rel", "calls")).append("| ")
                    .append(edge.get("to")).append("\n");
        }
        try (Writer writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8)) {
            writer.write(sb.toString());
        }
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
