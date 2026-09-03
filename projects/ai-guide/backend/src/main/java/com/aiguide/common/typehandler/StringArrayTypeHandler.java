package com.aiguide.common.typehandler;

import java.sql.Array;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

/**
 * PostgreSQL {@code text[]} 与 Java {@code List<String>} 互转的类型处理器。
 * 读取时把 {@link Array} 展平为字符串列表；写入时把列表编码为 PG 数组。
 * 用于内容标签（tags）等数组字段，避免 MyBatis 无默认 List 类型处理器导致映射失败。
 */
public class StringArrayTypeHandler extends BaseTypeHandler<List<String>> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<String> parameter, JdbcType jdbcType)
            throws SQLException {
        Array array = ps.getConnection().createArrayOf("text", parameter.toArray(new String[0]));
        ps.setArray(i, array);
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return toList(rs.getArray(columnName));
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return toList(rs.getArray(columnIndex));
    }

    @Override
    public List<String> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return toList(cs.getArray(columnIndex));
    }

    private List<String> toList(Array array) throws SQLException {
        if (array == null) {
            return null;
        }
        Object[] values = (Object[]) array.getArray();
        List<String> result = new ArrayList<>(values.length);
        for (Object value : values) {
            result.add(value == null ? null : value.toString());
        }
        return result;
    }
}
