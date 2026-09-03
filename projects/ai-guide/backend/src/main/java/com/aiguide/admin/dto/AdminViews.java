package com.aiguide.admin.dto;

import java.util.List;

/**
 * 管理后台响应视图。以嵌套 record 分组承载契约中的响应数据。
 */
public final class AdminViews {

    private AdminViews() {
    }

    public record LoginView(String token, String username, String role) {
    }

    public record MeView(String username, String role) {
    }

    public record TopicView(String code, String name, String description, Integer sortOrder,
                            boolean enabled, String updatedAt) {
    }

    public record CategoryView(String code, String topicCode, String name, String description,
                               Integer sortOrder, boolean enabled, String updatedAt) {
    }

    public record ContentListView(String code, String categoryCode, String type, String title,
                                  String status, Integer version, String updatedAt) {
    }

    public record ContentDetailView(String code, String categoryCode, String type, String title,
                                    String summary, String body, List<String> tags, String source,
                                    String status, boolean recommended, Integer version,
                                    String publishedAt, String updatedAt) {
    }

    public record ContentStatusView(String code, String status) {
    }

    public record ContentUpdateView(String code, Integer version) {
    }

    public record ContentPublishView(String code, String status, String publishedAt) {
    }

    public record TipListView(String orderNo, String contentCode, Integer amountCents, String status,
                              String contactValue, String createdAt) {
    }

    public record TipDetailView(String orderNo, String contentCode, Integer amountCents,
                                String contactName, String contactValue, String message, String status,
                                String receivedAt, String closedAt, String createdAt) {
    }

    public record ConsultationListView(String orderNo, String contactName, String contactValue,
                                       String topicText, Integer priceCents, String status, String createdAt) {
    }

    public record ConsultationDetailView(String orderNo, String contactName, String contactType,
                                         String contactValue, String topicText, String requestText,
                                         String expectedTime, Integer priceCents, boolean freeQuotaUsed,
                                         String status, String adminNote, String confirmedAt, String createdAt) {
    }

    public record OperationLogView(Long id, String username, String action, String targetType,
                                   String targetCode, String beforeState, String afterState, String createdAt) {
    }
}
