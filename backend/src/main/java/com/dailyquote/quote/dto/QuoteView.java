package com.dailyquote.quote.dto;

/**
 * 今日语录视图对象：字段与 contracts/quote.yaml 中 response.data 保持一致。
 * displayDate 为 Asia/Shanghai 口径的 YYYY-MM-DD 字符串，便于双端直接渲染。
 */
public class QuoteView {

    private String content;
    private String source;
    private String backgroundImage;
    private String displayDate;

    public QuoteView() {
    }

    public QuoteView(String content, String source, String backgroundImage, String displayDate) {
        this.content = content;
        this.source = source;
        this.backgroundImage = backgroundImage;
        this.displayDate = displayDate;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getBackgroundImage() {
        return backgroundImage;
    }

    public void setBackgroundImage(String backgroundImage) {
        this.backgroundImage = backgroundImage;
    }

    public String getDisplayDate() {
        return displayDate;
    }

    public void setDisplayDate(String displayDate) {
        this.displayDate = displayDate;
    }
}
