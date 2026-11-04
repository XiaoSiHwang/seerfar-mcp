# Seerfar API 覆盖清单

文档快照：2026-10-25-a4154cba9736；共 41 个接口。

工具名由文档接口 ID 稳定生成；请求参数及响应字段保存在快照中，可通过 seerfar_get_api_doc 查询。

| MCP 工具 | 方法 | 路径 | 接口 | 费用 | 频率 |
| --- | --- | --- | --- | --- | --- |
| `seerfar_quota` | GET | `/open-api/quota` | 查询 API Key 积分 | 0积分/次 | 1次/3秒 |
| `seerfar_ozon_shop_search` | POST | `/open-api/shop/detail/search/ozon` | Ozon 查店铺 | 10 积分/次 | 3次/3秒 |
| `seerfar_wb_shop_search` | POST | `/open-api/shop/detail/search/wb` | Wildberries 查店铺 | 10 积分/次 | 3次/3秒 |
| `seerfar_ozon_shop_brand_search` | POST | `/open-api/shop/detail/brand/search/ozon` | Ozon 查店铺品牌 | 10 积分/次 | 3次/3秒 |
| `seerfar_wb_shop_brand_search` | POST | `/open-api/shop/detail/brand/search/wb` | Wildberries 查店铺品牌 | 10 积分/次 | 3次/3秒 |
| `seerfar_ozon_shop_category_search` | POST | `/open-api/shop/detail/category/search/ozon` | Ozon 查店铺类目 | 10 积分/次 | 3次/3秒 |
| `seerfar_wb_shop_category_search` | POST | `/open-api/shop/detail/category/search/wb` | Wildberries 查店铺类目 | 10 积分/次 | 3次/3秒 |
| `seerfar_ozon_product_detail_search` | POST | `/open-api/product/detail/search/ozon` | Ozon 查竞品 | 3 积分/次 | 3次/3秒 |
| `seerfar_wb_product_detail_search` | POST | `/open-api/product/detail/search/wb` | Wildberries 查竞品 | 3 积分/次 | 3次/3秒 |
| `seerfar_ozon_product_similar` | POST | `/open-api/product/detail/similar/ozon` | Ozon 查相似商品 | 15 积分/次 | 3次/3秒 |
| `seerfar_wb_product_similar` | POST | `/open-api/product/detail/similar/wb` | Wildberries 查相似商品 | 15 积分/次 | 3次/3秒 |
| `seerfar_ozon_product_variations_characteristics` | POST | `/open-api/product/detail/variations/characteristics/ozon` | Ozon 查变体特征 | 1 积分/次 | 3次/3秒 |
| `seerfar_wb_product_variations_characteristics` | POST | `/open-api/product/detail/variations/characteristics/wb` | Wildberries 查变体特征 | 1 积分/次 | 3次/3秒 |
| `seerfar_ozon_product_variations_top` | POST | `/open-api/product/detail/variations/top/ozon` | Ozon 查 Top 变体 | 3 积分/次 | 3次/3秒 |
| `seerfar_wb_product_variations_top` | POST | `/open-api/product/detail/variations/top/wb` | Wildberries 查 Top 变体 | 3 积分/次 | 3次/3秒 |
| `seerfar_ozon_product_variations_search` | POST | `/open-api/product/detail/variations/search/ozon` | Ozon 查商品变体 | 3 积分/次 | 3次/3秒 |
| `seerfar_wb_product_variations_search` | POST | `/open-api/product/detail/variations/search/wb` | Wildberries 查商品变体 | 3 积分/次 | 3次/3秒 |
| `seerfar_ozon_product_collect` | POST | `/open-api/product/collect/ozon` | Ozon 采集商品 | 3 积分/SKU | 3次/3秒 |
| `seerfar_wb_product_collect` | POST | `/open-api/product/collect/wb` | Wildberries 采集商品 | 3 积分/SKU | 3次/3秒 |
| `seerfar_ozon_collect_box_page` | POST | `/open-api/collect-box/page/ozon` | Ozon 查询采集商品 | 3 积分/次 | 3次/3秒 |
| `seerfar_wb_collect_box_page` | POST | `/open-api/collect-box/page/wb` | Wildberries 查询采集商品 | 3 积分/次 | 3次/3秒 |
| `seerfar_ozon_category_search` | POST | `/open-api/category/detail/search/ozon` | Ozon 查类目 | 10 积分/次 | 3次/3秒 |
| `seerfar_wb_category_search` | POST | `/open-api/category/detail/search/wb` | Wildberries 查类目 | 10 积分/次 | 3次/3秒 |
| `seerfar_ozon_product_report_search` | POST | `/open-api/productReport/search/ozon` | Ozon 查热销榜单 | 10 积分/次 | 3次/3秒 |
| `seerfar_wb_product_report_search` | POST | `/open-api/productReport/search/wb` | Wildberries 查热销榜单 | 10 积分/次 | 3次/3秒 |
| `seerfar_ozon_market_keyword_search` | POST | `/open-api/market/search/ozon` | Ozon 查市场热词 | 10 积分/次 | 3次/3秒 |
| `seerfar_wb_market_keyword_search` | POST | `/open-api/market/search/wb` | Wildberries 查市场热词 | 10 积分/次 | 3次/3秒 |
| `seerfar_ozon_keyword_mining` | POST | `/open-api/keyword/mining/ozon` | Ozon 关键词挖掘 | 15 积分/次 | 3次/3秒 |
| `seerfar_wb_keyword_mining` | POST | `/open-api/keyword/mining/wb` | Wildberries 关键词挖掘 | 15 积分/次 | 3次/3秒 |
| `seerfar_ozon_keyword_back_search` | POST | `/open-api/keyword/backSearch/ozon` | Ozon 关键词反查 | 15 积分/次 | 3次/3秒 |
| `seerfar_wb_keyword_back_search` | POST | `/open-api/keyword/backSearch/wb` | Wildberries 关键词反查 | 15 积分/次 | 3次/3秒 |
| `seerfar_ozon_review_analyse_task_add` | POST | `/open-api/review/analyse/ozon/task/add` | Ozon 创建评论分析任务 | 200 积分/SKU | 3次/3秒 |
| `seerfar_ozon_review_analyse_report` | POST | `/open-api/review/analyse/ozon/report` | Ozon 查评论分析报表 | 0 积分/次 | 3次/3秒 |
| `seerfar_ozon_review_analyse_word_frequency` | POST | `/open-api/review/analyse/ozon/wordFrequency` | Ozon 查评论词频 | 0 积分/次 | 3次/3秒 |
| `seerfar_ozon_review_analyse_review_statistic` | POST | `/open-api/review/analyse/ozon/reviewStatistic` | Ozon 查评论统计 | 0 积分/次 | 3次/3秒 |
| `seerfar_ozon_review_analyse_original_review` | POST | `/open-api/review/analyse/ozon/originalReview` | Ozon 查原始评论 | 0 积分/次 | 3次/3秒 |
| `seerfar_wb_review_analyse_task_add` | POST | `/open-api/review/analyse/wb/task/add` | Wildberries 创建评论分析任务 | 200 积分/SKU | 3次/3秒 |
| `seerfar_wb_review_analyse_report` | POST | `/open-api/review/analyse/wb/report` | Wildberries 查评论分析报表 | 0 积分/次 | 3次/3秒 |
| `seerfar_wb_review_analyse_word_frequency` | POST | `/open-api/review/analyse/wb/wordFrequency` | Wildberries 查评论词频 | 0 积分/次 | 3次/3秒 |
| `seerfar_wb_review_analyse_review_statistic` | POST | `/open-api/review/analyse/wb/reviewStatistic` | Wildberries 查评论统计 | 0 积分/次 | 3次/3秒 |
| `seerfar_wb_review_analyse_original_review` | POST | `/open-api/review/analyse/wb/originalReview` | Wildberries 查原始评论 | 0 积分/次 | 3次/3秒 |
