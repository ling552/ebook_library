# 在线电子书阅读系统

一个简单的在线电子书阅读系统，支持上传和阅读电子书。

###前端：HTML+CSS+JavaScript 后端：Node.js

## 功能特点

- 支持多种图片格式（jpg、jpeg、png）
- 支持多种页面命名格式
- 简洁的阅读界面
- 自动保存阅读进度
- 书架式布局展示

## 使用说明

### 上传新书

1. 准备一个 ZIP 压缩文件，包含以下内容：

   - `config.json`：配置文件，包含以下字段：
     ```json
     {
       "title": "书籍标题",
       "total_pages": 页数
     }
     ```
   
   - 封面图片（支持以下任一格式）：
     - `cover.jpg`
     - `cover.jpeg`
     - `cover.png`
   
   - 页面图片（支持以下命名格式）：
     ```
     1.jpg/1.jpeg/1.png          - 纯数字格式
     1(2).jpg/1(2).png           - 数字括号格式（括号内为页码）
     1（2）.jpg/1（2）.png       - 数字中文括号格式（括号内为页码）
     a(2).jpg/a(2).png           - 字母括号格式（括号内为页码）
     a（2）.jpg/a（2）.png       - 字母中文括号格式（括号内为页码）
     ```

2. 点击"上传新书"按钮，选择 ZIP 文件上传

### 阅读书籍

1. 在书架界面点击要阅读的书籍封面
2. 在阅读界面：
   - 点击左侧区域：上一页
   - 点击右侧区域：下一页
   - 使用键盘方向键或 PageUp/PageDown 翻页
   - 点击"返回书架"回到主页面

## 技术说明

### 后端 API

- `GET /api/books`：获取所有书籍列表
- `GET /api/books/:id`：获取指定书籍详情
- `GET /api/books/:id/pages/:page`：获取指定书籍的指定页面
- `GET /api/progress/:bookId`：获取阅读进度
- `POST /api/progress/:bookId`：更新阅读进度
- `POST /api/books/upload`：上传新书

### 数据库结构

- books 表：存储书籍信息
  - id：自增主键
  - book_id：书籍唯一标识
  - title：书籍标题
  - cover_path：封面图片路径
  - total_pages：总页数
  - created_at：创建时间

- reading_progress 表：存储阅读进度
  - id：自增主键
  - book_id：关联的书籍ID
  - current_page：当前页码
  - last_read：最后阅读时间

## 注意事项

1. 确保上传的 ZIP 文件包含所有必需文件
2. 图片命名需要符合规范
3. 页面编号从 1 开始
4. 支持的图片格式：jpg、jpeg、png
5. 确保 config.json 中的页数与实际图片数量相符

## 常见问题

### 上传失败的可能原因

1. ZIP文件格式问题
   - 确保使用标准ZIP压缩方式
   - 不要使用加密或密码保护
   - 避免在文件名中使用特殊字符

2. 文件缺失
   - 检查是否包含 `config.json`
   - 检查是否包含 `cover.jpg`
   - 检查页面图片是否按规则命名

3. 配置文件错误
   - 确保 `config.json` 格式正确
   - 检查 `total_pages` 是否与实际页面数量匹配
   - 确保 JSON 格式有效

4. 图片命名问题
   - 确保图片使用支持的命名格式
   - 检查文件扩展名是否为小写的 `.jpg`
   - 确保文件名不包含其他特殊字符

### 阅读问题

1. 页面加载失败
   - 检查网络连接
   - 确认图片文件存在且可访问
   - 刷新页面重试

2. 进度保存问题
   - 确保浏览器允许 Cookie
   - 检查网络连接
   - 尝试重新打开书籍

## 技术支持

如遇到问题，请检查：
1. 服务器日志输出
2. 浏览器控制台错误信息
3. 网络请求状态

## 系统要求

- 现代浏览器（Chrome、Firefox、Safari、Edge 等）
- 支持 JavaScript
- 稳定的网络连接

## 注意事项

1. 建议上传前检查：
   - ZIP文件是否正确压缩
   - 文件命名是否符合规范
   - 图片是否为JPG格式
   - 配置文件是否正确

2. 性能建议：
   - 图片大小建议控制在2MB以内
   - 单本书籍总大小建议不超过100MB
   - 建议使用图片压缩工具优化 
