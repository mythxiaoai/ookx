const http = require('http');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

// 预先加载静态文件内容到内存中，解决Vercel环境下的文件访问问题
let staticFileCache = {};

async function loadStaticFiles() {
  try {
    console.log('[INFO] 尝试加载静态文件到内存');
    
    // 定义要加载的文件列表
    const filesToLoad = [
      { key: '/', path: 'index.html' },
      { key: '/test', path: 'test.html' }
    ];
    
    // 加载每个文件到内存
    for (const file of filesToLoad) {
      try {
        console.log(`[INFO] 加载文件: ${file.path}`);
        const filePath = path.join(process.cwd(), file.path);
        const content = await fs.readFile(filePath);
        staticFileCache[file.key] = {
          content,
          contentType: getContentType(file.path)
        };
        console.log(`[INFO] 已加载文件: ${file.path}`);
      } catch (err) {
        console.error(`[ERROR] 加载文件失败 ${file.path}: ${err.message}`);
      }
    }
    
    console.log(`[INFO] 静态文件加载完成，共 ${Object.keys(staticFileCache).length} 个文件`);
  } catch (error) {
    console.error(`[ERROR] 加载静态文件错误: ${error.message}`);
  }
}

// 在模块加载时就预加载文件
loadStaticFiles();

const getContentType = (name) => {
  if (name.endsWith('.js')) {
    return 'text/javascript';
  }
  if (name.endsWith('.css')) {
    return 'text/css';
  }
  if (name.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }
  return 'charset=utf-8';
}

async function handleRequest(req, res) {
  try {
    console.log(`[DEBUG] 处理请求: ${req.url}`);
    console.log(`[DEBUG] 请求方法: ${req.method}`);
    console.log(`[DEBUG] 请求头: ${JSON.stringify(req.headers)}`);
    console.log(`[DEBUG] 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[DEBUG] Vercel区域: ${process.env.VERCEL_REGION || '未知'}`);
    console.log(`[DEBUG] 当前工作目录: ${process.cwd()}`);
    
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathName = reqUrl.pathname;
    
    // 使用缓存的静态文件
    if (staticFileCache[pathName]) {
      console.log(`[INFO] 从内存缓存提供文件: ${pathName}`);
      const fileData = staticFileCache[pathName];
      
      res.writeHead(200, {
        'content-type': fileData.contentType
      });
      res.end(fileData.content);
      return;
    }
    
    // 如果没有缓存，尝试从磁盘读取（主要用于开发环境）
    if ((pathName === '/' || pathName === '/test') && process.env.NODE_ENV !== 'production') {
      const fileName = pathName === '/' ? 'index.html' : 'test.html';
      try {
        const filePath = path.join(process.cwd(), fileName);
        console.log(`[DEBUG] 尝试从磁盘读取文件: ${filePath}`);
        
        const file = await fs.readFile(filePath);
        
        res.writeHead(200, {
          'content-type': getContentType(fileName)
        });
        res.end(file);
        return;
      } catch (error) {
        console.error(`[ERROR] 文件读取错误: ${error.message}`);
      }
    }
    
    // 代理请求到OKX
    const originalUrl = new URL(reqUrl.toString());
    originalUrl.host = 'www.okx.com';
    originalUrl.protocol = 'https:';
    
    console.log(`[INFO] 代理请求到: ${originalUrl.toString()}`);
    
    // 使用https模块发送请求
    const proxyReq = https.request(originalUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        'host': originalUrl.host
      },
    }, (proxyRes) => {
      // 设置响应头
      const headers = { ...proxyRes.headers };
      headers['cache-control'] = 'public, max-age=31556952, immutable';
      
      res.writeHead(proxyRes.statusCode || 200, headers);
      
      // 将响应数据传回客户端
      proxyRes.pipe(res);
    });
    
    // 处理错误
    proxyReq.on('error', (error) => {
      console.error(`[ERROR] 代理请求错误: ${error.message}`);
      console.error(`[ERROR] 错误堆栈: ${error.stack}`);
      console.error(`[ERROR] 请求URL: ${originalUrl.toString()}`);
      res.writeHead(500);
      res.end(`Proxy Error: ${error.message}`);
    });
    
    // 如果有请求体，将其转发
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  } catch (error) {
    console.error(`[ERROR] 请求处理错误: ${error.message}`);
    console.error(`[ERROR] 错误堆栈: ${error.stack}`);
    console.error(`[ERROR] 请求URL: ${req.url}`);
    res.writeHead(500);
    res.end(`Server Error: ${error.message}`);
  }
}

// 创建一个简单的HTTP服务器，仅用于本地开发
const server = http.createServer(handleRequest);

// 为本地开发环境启动HTTP服务器
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`[INFO] 本地开发服务器运行在 http://localhost:${PORT}`);
  });
}

// 为Vercel导出处理函数
module.exports = (req, res) => {
  // 检查是否是WebSocket请求
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    // 对于WebSocket请求，我们只能返回一个错误，因为Vercel serverless函数不支持WebSocket
    res.writeHead(400);
    res.end('WebSocket connections are not supported in this serverless environment');
    return;
  }
  
  // 处理常规HTTP请求
  return handleRequest(req, res);
};
