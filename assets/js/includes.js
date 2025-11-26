/**
 * 皇城机关总图 (最终版 V3)
 * 包含:
 * 1. 动态加载 HTML 公共部分。
 * 2. 导航链接 'active' 状态高亮。
 * 3. 移动端导航交互。
 * 4. 路径+meta双策略动态加载 sidebar。
 * 5. ✅ 吊桥升级：带有 Spinner 的“发送中”状态。
 * 6. ✅ 乾坤大挪移：前端图片附件自动压缩。
 * 7. Favicon 全家桶动态注入。
 */

(function () {
  // ===================================================================
  // ✅ 吊桥升级 V1: 带有 Spinner 的发送按钮
  // ===================================================================
  function showSendingButton(form) {
    const button = form.querySelector("button[type='submit']");
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span> Sending to Engineering Team...';
      button.style.backgroundColor = "#ccc";
      button.style.color = "#666";
      button.style.cursor = "not-allowed";
    }
  }

  // ===================================================================
  // ✅ Favicon 模块
  // ===================================================================
  const faviconData = [
    { rel: 'shortcut icon', href: 'favicon.ico' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: 'apple-touch-icon.png' },
    { rel: 'icon', type: 'image/png', sizes: '96x96', href: 'favicon-96x96.png' },
    { rel: 'manifest', href: 'site.webmanifest' },
    { name: 'msapplication-TileColor', content: '#ff9933' },
    { name: 'theme-color', content: '#ffffff' }
  ];

  function injectFavicons(data, basePath) {
    const head = document.head;
    const prefix = (basePath === '/') ? '/' : basePath;
    data.forEach(item => {
      let element;
      if (item.rel) {
        element = document.createElement('link');
        element.rel = item.rel;
        if (item.sizes) element.sizes = item.sizes;
        if (item.type) element.type = item.type;
        element.href = normalizePath(prefix + item.href); 
      } else if (item.name) {
        element = document.createElement('meta');
        element.name = item.name;
        element.content = item.content;
      }
      if (element) {
        head.appendChild(element);
      }
    });
  }

  // ===================================================================
  // ✅ 核心工具函数
  // ===================================================================
  function getBasePath() {
    const mainScript = document.getElementById('main-include-script');
    if (!mainScript) return "/";
    const scriptUrl = new URL(mainScript.src, window.location.href);
    let pathName = scriptUrl.pathname;
    const pathSuffix = "assets/js/includes.js";
    if (!pathName.endsWith(pathSuffix)) return "/";
    return pathName.substring(0, pathName.lastIndexOf(pathSuffix));
  }

  function loadHTML(selector, filePath, basePath) {
    const element = document.querySelector(selector);
    if (element) {
      const fullPath = normalizePath(basePath + filePath);
      fetch(fullPath)
      .then(response => {
        if (!response.ok) throw new Error(`File not found: ${fullPath}`);
        return response.text();
      })
      .then(data => {
        element.innerHTML = data;
        if (['#header-placeholder', '#footer-placeholder', '#sidebar-placeholder'].includes(selector)) {
          prefixLinksWithBasePath(basePath, selector);
        }
        if (selector === '#header-placeholder') {
          applyActiveClassByURL();
          initializeHeaderInteractions();
        }
      })
      .catch(error => console.error(`Error loading ${filePath}:`, error));
    }
  }
  
  function prefixLinksWithBasePath(basePath, contextSelector) {
    let processedPath = basePath === '/' ? '' : (basePath.endsWith('/') ? basePath.slice(0, -1) : basePath);
    if (processedPath === '') return;
    const contextElement = document.querySelector(contextSelector);
    if (!contextElement) return;
    ['a', 'img'].forEach(tagName => {
      contextElement.querySelectorAll(tagName).forEach(el => {
        const attr = tagName === 'a' ? 'href' : 'src';
        const value = el.getAttribute(attr);
        if (!value || value.startsWith('http') || value.startsWith('#') || value.startsWith('//') || value.startsWith('mailto:') || value.startsWith('tel:')) {
          return;
        }
        if (value.startsWith('/')) {
          el.setAttribute(attr, processedPath + value);
        }
      });
    });
  }

  function applyActiveClassByURL() {
    const currentPath = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '/');
    const navLinks = document.querySelectorAll('nav a');
    let bestMatchLink = null;
    navLinks.forEach(link => {
      if (!link.href) return;
      try {
        const linkPath = new URL(link.href).pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '/');
        if (currentPath.startsWith(linkPath)) {
          if (!bestMatchLink || linkPath.length > new URL(bestMatchLink.href).pathname.length) {
            bestMatchLink = link;
          }
        }
      } catch (e) { /* ignore invalid hrefs */ }
    });
    navLinks.forEach(link => {
      link.classList.remove('active', 'active-parent');
    });
    if (bestMatchLink) {
      bestMatchLink.classList.add('active');
      const parentDropdown = bestMatchLink.closest('.has-dropdown');
      if (parentDropdown) {
        parentDropdown.querySelector('a')?.classList.add('active-parent');
      }
    }
  }

  function normalizePath(path) {
    return path.replace(/([^:])(\/\/+)/g, '$1/');
  }

  function initializeHeaderInteractions() {
    const hamburger = document.getElementById('hamburger-menu');
    const body = document.body;
    hamburger?.addEventListener('click', () => body.classList.toggle('nav-open'));
    const dropdownToggles = document.querySelectorAll('.has-dropdown > a');
    const isMobileView = () => window.innerWidth <= 768;
    dropdownToggles.forEach(toggle => {
      toggle.addEventListener('click', function (e) {
        if (isMobileView()) {
          e.preventDefault();
          this.parentElement.classList.toggle('menu-open');
        }
      });
    });
  }

 function getSidebarFile() {
  const path = window.location.pathname.toLowerCase();
  const metaSidebar = document.querySelector('meta[name="sidebar-type"]');

  // 🥇 优先使用 meta 策略（原逻辑保留）
  if (metaSidebar) {
    const type = metaSidebar.content.trim().toLowerCase();
    if (type === 'applications') return '_sidebar-applications.html';
    if (type === 'blog') return '_sidebar-blog.html';
    if (type === 'industry') return '_sidebar-industry.html'; 
  }

  // 🥈 路径策略（新增 industry-maps，保持原结构不变）
  if (path.includes('/applications/')) return '_sidebar-applications.html';
  if (path.includes('/blog/')) return '_sidebar-blog.html';
  if (path.includes('/industry-maps/')) return '_sidebar-industry.html';

  // 🥉 默认 fallback
  return '_sidebar.html';
}

  // ===================================================================
  // ✅ 吊桥升级 V2: 乾坤大挪移 - 前端图片压缩核心逻辑
  // ===================================================================
  function initializeFormCompression() {
    const form = document.querySelector('form[action*="/api/technical-inquiry"]');
    if (!form || typeof imageCompression === 'undefined') {
      return;
    }

    form.addEventListener('submit', async function(event) {
      event.preventDefault(); // 拦截表单的默认提交行为
      showSendingButton(form); // 启动“障眼法”，显示发送中...

      const imageFile = document.getElementById('drawing-file')?.files[0];
      const isCompressible = imageFile && imageFile.type.startsWith('image/') && imageFile.size > 200 * 1024; // 大于200KB的图片才值得压缩

      if (!isCompressible) {
        form.submit(); // 直接提交原始表单
        return;
      }

      console.log(`Original image size: ${(imageFile.size / 1024 / 1024).toFixed(2)} MB`);

      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.7
      };

      try {
        const compressedFile = await imageCompression(imageFile, options);
        console.log(`Compressed image size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([compressedFile], imageFile.name, { type: compressedFile.type }));
        document.getElementById('drawing-file').files = dataTransfer.files;

        form.submit(); // 提交带有“瘦身”后文件的表单
      } catch (error) {
        console.error('Image compression failed:', error);
        form.submit(); // 即使压缩失败，也要保证能提交原文件
      }
    });
  }

  // ===================================================================
  // ✅ 页面加载执行入口
  // ===================================================================
  document.addEventListener("DOMContentLoaded", function () {
    const basePath = getBasePath();
    injectFavicons(faviconData, basePath);
    loadHTML('#header-placeholder', '_header.html', basePath);
    loadHTML('#footer-placeholder', '_footer.html', basePath);
    loadHTML('#sidebar-placeholder', getSidebarFile(), basePath);
    loadHTML('#author-bio-placeholder', '_author-bio.html', basePath);
    initializeFormCompression(); // 注入“乾坤大挪移心法”
  });

})(); // 立即执行函数结束