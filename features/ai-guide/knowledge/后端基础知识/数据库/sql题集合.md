1. OrderItems 表含有：订单号 order_num，quantity产品数量

order_num	quantity
a1	105
a2	1100
a2	200
a4	1121
a5	10
a2	19
a7	5
【问题】从 OrderItems 表中检索出所有不同且不重复的订单号（order_num），其中每个订单都要包含 100 个或更多的产品。

答：
SELECT order_num
FROM OrderItems
GROUP BY order_num
HAVING SUM(quantity) >= 100

2. 给出 Customers 表 如下：

cust_id	cust_name	cust_contact	cust_city
a1	Andy Li	   Andy Li	   Oak Park
a2	Ben Liu	   Ben Liu	   Oak Park
a3	Tony Dai	Tony Dai	   Oak Park
a4	Tom Chen	Tom Chen	   Oak Park
a5	An Li	An Li	   Oak Park
a6	Lee Chen	Lee Chen	   Oak Park
a7	Hex Liu	Hex Liu	   Oak Park
【问题】编写 SQL 语句，返回顾客 ID（cust_id）、顾客名称（cust_name）和登录名（user_login），其中登录名全部为大写字母，并由顾客联系人的前两个字符（cust_contact）和其所在城市的前三个字符（cust_city）组成。提示：需要使用函数、拼接和别名。

答案：
SELECT cust_id, cust_name, UPPER(CONCAT(SUBSTRING(cust_contact, 1, 2), SUBSTRING(cust_city, 1, 3))) AS user_login
FROM Customers

3. 返回 2020 年 1 月的所有订单的订单号和订单日期
Orders 订单表如下：

order_num	order_date
a0001	2020-01-01 00:00:00
a0002	2020-01-02 00:00:00
a0003	2020-01-01 12:00:00
a0004	2020-02-01 00:00:00
a0005	2020-03-01 00:00:00
【问题】编写 SQL 语句，返回 2020 年 1 月的所有订单的订单号（order_num）和订单日期（order_date），并按订单日期升序排序

答案：
SELECT order_num, order_date
FROM Orders
WHERE month(order_date) = '01' AND YEAR(order_date) = '2020'
ORDER BY order_date

4. 现有试卷信息表 examination_info（exam_id 试卷 ID, tag 试卷类别, difficulty 试卷难度, duration 考试时长, release_time 发布时间）：

id	exam_id	tag	difficulty	duration	release_time
1	9001	SQL	hard	60	2021-09-01 06:00:00
2	9002	SQL	hard	60	2021-09-01 06:00:00
3	9003	算法	medium	80	2021-09-01 10:00:00
试卷作答记录表 exam_record（uid 用户 ID, exam_id 试卷 ID, start_time 开始作答时间, submit_time 交卷时间, score 得分）：

id	uid	exam_id	start_time	submit_time	score
1	1001	9001	2021-09-01 09:01:01	2021-09-01 09:31:00	78
2	1002	9001	2021-09-01 09:01:01	2021-09-01 09:31:00	81
3	1002	9002	2021-09-01 12:01:01	2021-09-01 12:31:01	81
4	1003	9001	2021-09-01 19:01:01	2021-09-01 19:40:01	86
5	1003	9002	2021-09-01 12:01:01	2021-09-01 12:31:51	89
6	1004	9001	2021-09-01 19:01:01	2021-09-01 19:30:01	85
7	1005	9003	2021-09-01 12:01:01	2021-09-01 12:31:02	85
8	1006	9003	2021-09-07 10:01:01	2021-09-07 10:21:01	84
9	1003	9003	2021-09-08 12:01:01	2021-09-08 12:11:01	40
10	1003	9002	2021-09-01 14:01:01	(NULL)	(NULL)
找到每类试卷得分的前 3 名，如果两人最大分数相同，选择最小分数大者，如果还相同，选择 uid 大者。由示例数据结果输出如下：

tid	uid	ranking
SQL	1003	1
SQL	1004	2
SQL	1002	3
算法	1005	1
算法	1006	2
算法	1003	3
解释：有作答得分记录的试卷 tag 有 SQL 和算法，SQL 试卷用户 1001、1002、1003、1004 有作答得分，最高得分分别为 81、81、89、85，最低得分分别为 78、81、86、40，因此先按最高得分排名再按最低得分排名取前三为 1003、1004、1002。

答：
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