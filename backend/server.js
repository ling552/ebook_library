const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const extract = require('extract-zip');
const path = require('path');
const fs = require('fs');
const dbConfig = require('./config/database');

const app = express();
const port = 8081;

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 数据库连接
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
pool.getConnection((err, connection) => {
    if (err) {
        console.error('数据库连接失败:', err);
        return;
    }
    console.log('数据库连接成功');
    
    // 创建books表
    const createBooksTable = `
        CREATE TABLE IF NOT EXISTS books (
            id INT AUTO_INCREMENT PRIMARY KEY,
            book_id VARCHAR(255) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            cover_path VARCHAR(255),
            total_pages INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    connection.query(createBooksTable, (err) => {
        if (err) {
            console.error('创建books表失败:', err);
            connection.release();
            return;
        }
        console.log('books表创建成功');
        
        // 创建reading_progress表
        const createProgressTable = `
            CREATE TABLE IF NOT EXISTS reading_progress (
                id INT AUTO_INCREMENT PRIMARY KEY,
                book_id INT,
                current_page INT DEFAULT 1,
                last_read TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;
        
        connection.query(createProgressTable, (err) => {
            connection.release();
            if (err) {
                console.error('创建reading_progress表失败:', err);
                return;
            }
            console.log('reading_progress表创建成功');
        });
    });
});

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '.zip');
    }
});

const upload = multer({ storage });

// API路由
// 获取所有书籍
app.get('/api/books', (req, res) => {
    pool.query('SELECT * FROM books', (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// 获取单本书籍详情
app.get('/api/books/:id', (req, res) => {
    const { id } = req.params;
    console.log('请求书籍详情，ID:', id);
    
    pool.query(
        'SELECT * FROM books WHERE book_id = ?',
        [id],
        (err, results) => {
            if (err) {
                console.error('数据库查询错误:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            if (results.length === 0) {
                console.error('未找到书籍:', id);
                res.status(404).json({ error: '书籍不存在' });
                return;
            }
            console.log('找到书籍:', results[0]);
            res.json(results[0]);
        }
    );
});

// 获取特定书籍的页面
app.get('/api/books/:id/pages/:page', (req, res) => {
    const { id, page } = req.params;
    console.log('请求页面，书籍ID:', id, '页码:', page);
    
    // 首先验证书籍是否存在
    pool.query(
        'SELECT * FROM books WHERE book_id = ?',
        [id],
        async (err, results) => {
            if (err) {
                console.error('数据库查询错误:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            if (results.length === 0) {
                console.error('未找到书籍:', id);
                res.status(404).json({ error: '书籍不存在' });
                return;
            }

            try {
                // 从cover_path中提取目录名
                const bookDir = results[0].cover_path.split('/')[2];
                const bookPath = path.join(__dirname, 'uploads', bookDir);
                
                // 获取目录中的所有文件
                const files = await fs.promises.readdir(bookPath);
                
                // 定义文件名匹配函数
                const matchPageFile = (files, targetPage) => {
                    // 支持的图片格式
                    const imageExts = '(?:jpg|jpeg|png)';
                    
                    // 正则表达式匹配各种可能的格式
                    const patterns = [
                        new RegExp(`^${targetPage}\\.${imageExts}$`, 'i'),                    // 1.jpg/1.png
                        new RegExp(`^\\d+\\(${targetPage}\\)\\.${imageExts}$`, 'i'),         // 1(1).jpg/1(1).png
                        new RegExp(`^\\d+（${targetPage}）\\.${imageExts}$`, 'i'),           // 1（1）.jpg/1（1）.png
                        new RegExp(`^[a-z]+\\(${targetPage}\\)\\.${imageExts}$`, 'i'),       // a(1).jpg/a(1).png
                        new RegExp(`^[a-z]+（${targetPage}）\\.${imageExts}$`, 'i')          // a（1）.jpg/a（1）.png
                    ];

                    // 遍历所有文件，查找匹配的文件名
                    return files.find(file => 
                        patterns.some(pattern => pattern.test(file))
                    );
                };

                console.log('正在查找页面:', page);
                const matchingFile = matchPageFile(files, page);

                if (matchingFile) {
                    const pagePath = path.join(bookPath, matchingFile);
                    console.log('找到匹配的页面文件:', pagePath);
                    res.sendFile(pagePath);
                } else {
                    console.error('未找到匹配的页面文件，目录内容:', files);
                    res.status(404).json({ error: '页面不存在' });
                }
            } catch (error) {
                console.error('处理页面请求时出错:', error);
                res.status(500).json({ error: '服务器内部错误' });
            }
        }
    );
});

// 获取阅读进度
app.get('/api/progress/:bookId', (req, res) => {
    const { bookId } = req.params;
    console.log('请求阅读进度，书籍ID:', bookId);
    
    // 首先验证书籍是否存在
    pool.query(
        'SELECT * FROM books WHERE book_id = ?',
        [bookId],
        (err, bookResults) => {
            if (err) {
                console.error('数据库查询错误:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            if (bookResults.length === 0) {
                console.error('未找到书籍:', bookId);
                res.status(404).json({ error: '书籍不存在' });
                return;
            }

            // 然后获取阅读进度
            pool.query(
                'SELECT current_page FROM reading_progress WHERE book_id = ?',
                [bookResults[0].id],
                (err, results) => {
                    if (err) {
                        console.error('获取阅读进度错误:', err);
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    console.log('阅读进度:', results[0] || { current_page: 1 });
                    res.json(results[0] || { current_page: 1 });
                }
            );
        }
    );
});

// 更新阅读进度
app.post('/api/progress/:bookId', (req, res) => {
    const { bookId } = req.params;
    const { page } = req.body;
    console.log('更新阅读进度，书籍ID:', bookId, '页码:', page);
    
    // 首先验证书籍是否存在
    pool.query(
        'SELECT * FROM books WHERE book_id = ?',
        [bookId],
        (err, bookResults) => {
            if (err) {
                console.error('数据库查询错误:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            if (bookResults.length === 0) {
                console.error('未找到书籍:', bookId);
                res.status(404).json({ error: '书籍不存在' });
                return;
            }

            // 然后更新或插入阅读进度
            pool.query(
                `INSERT INTO reading_progress (book_id, current_page) 
                 VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE current_page = ?`,
                [bookResults[0].id, page, page],
                (err) => {
                    if (err) {
                        console.error('更新阅读进度错误:', err);
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    console.log('阅读进度更新成功');
                    res.json({ success: true });
                }
            );
        }
    );
});

// 上传新书
app.post('/api/books/upload', upload.single('book'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('未收到文件');
        }

        console.log('收到上传文件:', req.file.originalname);

        // 从文件名中提取书籍ID
        const bookId = path.basename(req.file.originalname, '.zip');
        const extractPath = path.join(__dirname, 'uploads', bookId);
        
        console.log('解压目标路径:', extractPath);

        // 确保目录存在并且是空的
        if (fs.existsSync(extractPath)) {
            await fs.promises.rm(extractPath, { recursive: true, force: true });
        }
        await fs.promises.mkdir(extractPath, { recursive: true });

        // 解压文件
        try {
            console.log('开始解压文件:', req.file.path);
            await extract(req.file.path, { dir: extractPath });
            console.log('文件解压完成');
        } catch (error) {
            console.error('解压失败详细信息:', error);
            throw new Error(`文件解压失败: ${error.message}`);
        }

        // 验证解压后的文件
        const extractedFiles = await fs.promises.readdir(extractPath);
        console.log('解压出的文件列表:', extractedFiles);

        // 验证必要文件
        const configPath = path.join(extractPath, 'config.json');
        // 查找封面文件（支持多种格式）
        const coverFiles = ['cover.jpg', 'cover.jpeg', 'cover.png'];
        const coverFile = coverFiles.find(file => fs.existsSync(path.join(extractPath, file)));

        if (!fs.existsSync(configPath)) {
            throw new Error('缺少config.json文件');
        }
        if (!coverFile) {
            throw new Error('缺少封面文件（支持jpg、jpeg、png格式）');
        }

        // 读取配置文件
        let config;
        try {
            const configContent = await fs.promises.readFile(configPath, 'utf8');
            console.log('配置文件内容:', configContent);
            config = JSON.parse(configContent);
        } catch (error) {
            throw new Error(`配置文件读取失败: ${error.message}`);
        }

        if (!config.title || !config.total_pages) {
            throw new Error('config.json格式不正确，需要包含title和total_pages字段');
        }

        // 验证所有页面图片是否存在
        const pageFiles = await fs.promises.readdir(extractPath);
        const pagePattern = /^(?:\d+(?:\(\d+\)|\（\d+\）)?|[a-z]+(?:\(\d+\)|\（\d+\）)?)\.(?:jpg|jpeg|png)$/i;
        const pageImages = pageFiles.filter(file => pagePattern.test(file));

        console.log('找到的图片文件:', pageImages);

        if (pageImages.length === 0) {
            throw new Error('未找到符合命名规则的页面图片');
        }

        if (pageImages.length < config.total_pages) {
            throw new Error(`图片数量不足，需要 ${config.total_pages} 张，实际只有 ${pageImages.length} 张`);
        }

        // 构建相对URL（使用找到的封面文件）
        const coverUrl = `/uploads/${bookId}/${coverFile}`;
        console.log('保存的封面URL:', coverUrl);

        // 数据库操作
        try {
            await new Promise((resolve, reject) => {
                const query = 'INSERT INTO books (book_id, title, total_pages, cover_path) VALUES (?, ?, ?, ?)';
                pool.query(query, [bookId, config.title, config.total_pages, coverUrl], (error) => {
                    if (error) {
                        reject(new Error('保存到数据库失败: ' + error.message));
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            // 如果数据库操作失败，清理已解压的文件
            await fs.promises.rm(extractPath, { recursive: true, force: true });
            throw error;
        }

        res.json({ 
            success: true, 
            message: '上传成功',
            details: {
                bookId,
                title: config.title,
                totalPages: config.total_pages,
                coverUrl
            }
        });
    } catch (error) {
        console.error('上传处理错误:', error);
        res.status(400).json({ 
            error: error.message,
            details: '请确保上传的ZIP文件包含：\n1. config.json（包含title和total_pages字段）\n2. 封面文件（支持jpg、jpeg、png格式）\n3. 按规则命名的页面图片（支持jpg、jpeg、png格式）'
        });
    } finally {
        // 清理临时文件
        if (req.file) {
            await fs.promises.unlink(req.file.path).catch(console.error);
        }
    }
});

app.listen(port, 'localhost', () => {
    console.log(`服务器运行在 http://localhost:${port}`);
}); 