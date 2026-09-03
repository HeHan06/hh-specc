## 问题

现有试卷信息表 examination_info（exam_id、tag、difficulty、duration、release_time）和试卷作答记录表 exam_record（uid、exam_id、start_time、submit_time、score）。找到每类试卷得分的前 3 名，如果两人最大分数相同，选择最小分数大者，如果还相同，选择 uid 大者。

## 考察点

- 窗口函数 ROW_NUMBER 与 PARTITION BY 分组排名
- 多字段排序（max、min、uid）与聚合 + 排名结合

## 标准答案

```sql
SELECT tag,
       UID,
       ranking
FROM
  (SELECT b.tag AS tag,
          a.uid AS UID,
          ROW_NUMBER() OVER (PARTITION BY b.tag
                             ORDER BY b.tag,
                                      max(a.score) DESC,
                                      min(a.score) DESC,
                                      a.uid DESC) AS ranking
   FROM exam_record a
   LEFT JOIN examination_info b ON a.exam_id = b.exam_id
   GROUP BY b.tag,
            a.uid) t
WHERE ranking <= 3
```

## 关联

- 窗口函数
- SQL 逻辑执行顺序
