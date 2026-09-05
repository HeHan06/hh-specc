package com.aiguide.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 管理后台请求 DTO。以嵌套 record 分组承载契约中的请求体，避免后台包内创建过多碎片文件。
 */
public final class AdminRequests {

    private AdminRequests() {
    }

    public record LoginRequest(
            @NotBlank @Size(max = 64) String username,
            @NotBlank @Size(max = 100) String password
    ) {
    }

    public record TopicCreateRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 100) String name,
            @Size(max = 500) String description,
            Integer sortOrder,
            Boolean enabled
    ) {
    }

    public record TopicUpdateRequest(
            @NotBlank @Size(max = 100) String name,
            @Size(max = 500) String description,
            Integer sortOrder,
            @NotNull Boolean enabled
    ) {
    }

    public record CategoryCreateRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 64) String topicCode,
            @NotBlank @Size(max = 100) String name,
            @Size(max = 500) String description,
            Integer sortOrder,
            Boolean enabled
    ) {
    }

    public record CategoryUpdateRequest(
            @NotBlank @Size(max = 64) String topicCode,
            @NotBlank @Size(max = 100) String name,
            @Size(max = 500) String description,
            Integer sortOrder,
            @NotNull Boolean enabled
    ) {
    }

    public record ContentCreateRequest(
            @NotBlank @Size(max = 64) String categoryCode,
            @NotBlank @Size(max = 20) String type,
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 500) String summary,
            @NotBlank String body,
            List<String> tags,
            @NotBlank @Size(max = 16) String source
    ) {
    }

    public record ContentUpdateRequest(
            @NotBlank @Size(max = 64) String categoryCode,
            @NotBlank @Size(max = 20) String type,
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 500) String summary,
            @NotBlank String body,
            List<String> tags,
            @NotBlank @Size(max = 16) String source,
            Boolean recommended,
            @NotNull Integer version
    ) {
    }

    public record PublishRequest(
            @NotNull Boolean reviewConfirmed,
            @NotNull Integer version
    ) {
    }

    public record UnpublishRequest(@NotNull Integer version) {
    }

    public record RestoreRequest(
            @NotNull Boolean reviewConfirmed,
            @NotNull Integer version
    ) {
    }

    public record ArchiveRequest(@NotNull Integer version) {
    }

    public record AdvertisementUpdateRequest(
            @NotBlank @Size(max = 100) String title,
            @Size(max = 500) String description,
            @NotBlank @Size(max = 500) String link,
            @NotNull Boolean enabled
    ) {
    }
}
