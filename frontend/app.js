const API_BASE_URL = 'http://book.ling00.top/api';

// DOM 元素
const bookshelf = document.getElementById('bookshelf');
const reader = document.getElementById('reader');
const pageImage = document.getElementById('pageImage');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const backToShelfBtn = document.getElementById('backToShelf');
const bookUploadInput = document.getElementById('bookUpload');
const prevPageArea = document.getElementById('prevPageArea');
const nextPageArea = document.getElementById('nextPageArea');

// 当前阅读状态
let currentBook = null;
let currentPage = 1;

// 加载书架
async function loadBookshelf() {
    try {
        const response = await fetch(`${API_BASE_URL}/books`);
        if (!response.ok) {
            throw new Error('获取书籍列表失败');
        }
        
        const books = await response.json();
        console.log('获取到的书籍列表:', books);
        
        if (books.length === 0) {
            bookshelf.innerHTML = '<div class="no-books">暂无书籍，请上传新书</div>';
            return;
        }
        
        bookshelf.innerHTML = books.map(book => {
            // 构建完整的封面URL
            const coverUrl = `http://book.ling00.top${book.cover_path}`;
            console.log('封面URL:', coverUrl);
            console.log('书籍信息:', book); // 添加调试日志
            return `
                <div class="book-card" onclick="openBook('${book.book_id}')">
                    <img src="${coverUrl}" alt="${book.title}" class="book-cover" 
                         onerror="this.onerror=null; this.src='placeholder.jpg';">
                    <div class="book-info">
                        <h3 class="book-title">${book.title}</h3>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('加载书架失败:', error);
        bookshelf.innerHTML = '<div class="error-message">加载书架失败，请刷新页面重试</div>';
    }
}

// 打开书籍
async function openBook(bookId) {
    try {
        console.log('正在打开书籍:', bookId);
        
        // 获取书籍信息
        const bookResponse = await fetch(`${API_BASE_URL}/books/${bookId}`);
        if (!bookResponse.ok) {
            const errorData = await bookResponse.json();
            console.error('获取书籍信息失败:', errorData);
            throw new Error(errorData.error || '获取书籍信息失败');
        }
        const book = await bookResponse.json();
        console.log('获取到的书籍信息:', book);
        
        // 获取阅读进度
        const progressResponse = await fetch(`${API_BASE_URL}/progress/${bookId}`);
        if (!progressResponse.ok) {
            const errorData = await progressResponse.json();
            console.error('获取阅读进度失败:', errorData);
            throw new Error(errorData.error || '获取阅读进度失败');
        }
        const progress = await progressResponse.json();
        console.log('获取到的阅读进度:', progress);
        
        currentBook = bookId;
        currentPage = progress.current_page || 1;
        totalPagesSpan.textContent = book.total_pages;
        
        // 显示阅读器
        bookshelf.style.display = 'none';
        reader.style.display = 'flex';
        
        // 加载当前页
        await loadPage();
    } catch (error) {
        console.error('打开书籍失败:', error);
        alert(error.message || '打开书籍失败，请重试');
        // 确保在失败时返回书架视图
        backToShelf();
    }
}

// 加载页面
async function loadPage() {
    try {
        if (!currentBook) {
            throw new Error('未选择书籍');
        }
        
        currentPageSpan.textContent = currentPage;
        
        // 预加载图片
        const img = new Image();
        const imgUrl = `${API_BASE_URL}/books/${currentBook}/pages/${currentPage}`;
        console.log('正在加载页面图片:', imgUrl);
        
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = (e) => {
                console.error('图片加载失败:', e);
                reject(new Error('加载图片失败'));
            };
            img.src = imgUrl;
        });
        
        // 图片加载成功后更新显示
        pageImage.src = imgUrl;
        
        // 保存阅读进度
        const response = await fetch(`${API_BASE_URL}/progress/${currentBook}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ page: currentPage })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('保存阅读进度失败:', errorData);
            throw new Error(errorData.error || '保存阅读进度失败');
        }
    } catch (error) {
        console.error('加载页面失败:', error);
        alert(error.message || '加载页面失败，请重试');
    }
}

// 上一页
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadPage();
    }
}

// 下一页
function nextPage() {
    if (currentPage < parseInt(totalPagesSpan.textContent)) {
        currentPage++;
        loadPage();
    }
}

// 返回书架
function backToShelf() {
    reader.style.display = 'none';
    bookshelf.style.display = 'grid';
    currentBook = null;
    currentPage = 1;
}

// 上传新书
async function handleBookUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
        alert('请上传ZIP格式的文件，文件内图片命名规则：\n' + 
              '1. 数字格式：1.jpg, 2.jpg 等\n' +
              '2. 带括号格式：1(1).jpg, 1(2).jpg 等\n' +
              '3. 字母格式：a(1).jpg, a(2).jpg 等\n' +
              '4. 中文括号格式：1（1）.jpg, 1（2）.jpg 等');
        event.target.value = '';
        return;
    }

    // 显示上传中的提示
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'loading-message';
    loadingMessage.textContent = '正在上传和处理文件，请稍候...\n支持的页面命名格式：1.jpg、1(1).jpg、1（1）.jpg、a(1).jpg等';
    document.body.appendChild(loadingMessage);
    
    const formData = new FormData();
    formData.append('book', file);
    
    try {
        const response = await fetch(`${API_BASE_URL}/books/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log('上传响应:', result);
        
        if (response.ok) {
            alert('上传成功！');
            await loadBookshelf();  // 重新加载书架
        } else {
            throw new Error(result.error || '上传失败');
        }
    } catch (error) {
        console.error('上传失败:', error);
        alert(error.message || '上传失败，请重试');
    } finally {
        // 移除加载提示
        document.body.removeChild(loadingMessage);
        // 清除文件选择
        event.target.value = '';
    }
}

// 事件监听
prevPageBtn.addEventListener('click', prevPage);
nextPageBtn.addEventListener('click', nextPage);
backToShelfBtn.addEventListener('click', backToShelf);
bookUploadInput.addEventListener('change', handleBookUpload);
prevPageArea.addEventListener('click', prevPage);
nextPageArea.addEventListener('click', nextPage);

// 添加触摸事件支持
let touchStartX = 0;
let touchEndX = 0;

reader.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
});

reader.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].clientX;
    handleSwipe();
});

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    const minSwipeDistance = 50; // 最小滑动距离

    if (Math.abs(swipeDistance) > minSwipeDistance) {
        if (swipeDistance > 0) {
            prevPage(); // 向右滑动，上一页
        } else {
            nextPage(); // 向左滑动，下一页
        }
    }
}

// 键盘快捷键
document.addEventListener('keydown', (event) => {
    if (currentBook) {
        if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
            prevPage();
        } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
            nextPage();
        } else if (event.key === 'Escape') {
            backToShelf();
        }
    }
});

// 初始加载
loadBookshelf(); 