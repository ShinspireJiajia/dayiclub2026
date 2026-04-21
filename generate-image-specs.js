/**
 * 圖片素材尺寸標註工具
 * 使用 Playwright 自動擷取每個頁面的截圖，並標註所有圖片的顯示尺寸
 * 產出結果放在 image-specs/ 資料夾
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = __dirname;
const OUTPUT_DIR = path.join(PROJECT_DIR, 'image-specs');
const PAGES_DIR = path.join(PROJECT_DIR, 'pages');

// 頁面清單及中文名稱
const PAGE_LIST = [
  { file: 'home.html', name: '首頁' },
  { file: 'room-list.html', name: '客房列表' },
  { file: 'room-detail.html', name: '客房詳情' },
  { file: 'dining.html', name: '餐飲' },
  { file: 'leisure.html', name: '休閒設施' },
  { file: 'themed-events.html', name: '主題活動' },
  { file: 'classroom-tour.html', name: '教室導覽' },
  { file: 'news.html', name: '最新消息' },
  { file: 'news-article-1.html', name: '新聞文章-1' },
  { file: 'news-article-2.html', name: '新聞文章-2' },
  { file: 'news-article-3.html', name: '新聞文章-3' },
  { file: 'academy-philosophy.html', name: '學苑理念' },
  { file: 'gym-philosophy.html', name: '健身理念' },
  { file: 'gym-team.html', name: '健身團隊' },
  { file: 'health-center.html', name: '健康中心' },
  { file: 'wellness-philosophy.html', name: '養生哲學' },
  { file: 'lifestyle-butler.html', name: '生活管家' },
  { file: 'environment.html', name: '周邊環境' },
  { file: 'transport.html', name: '交通資訊' },
  { file: 'booking.html', name: '預約導覽' },
  { file: 'careers.html', name: '人才招募' },
  { file: 'privacy.html', name: '隱私政策' },
];

// 配色方案
const COLORS = {
  imgBorder: 'rgba(0, 150, 255, 0.8)',        // 藍色 - <img> 圖片
  bgBorder: 'rgba(255, 100, 0, 0.85)',         // 橘色 - 背景圖片
  labelBg: 'rgba(0, 120, 220, 0.92)',          // 藍色標籤背景
  bgLabelBg: 'rgba(220, 80, 0, 0.92)',         // 橘色標籤背景
  labelText: '#FFFFFF',
};

async function main() {
  // 建立輸出資料夾
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const allPagesData = [];

  for (const pageInfo of PAGE_LIST) {
    const filePath = path.join(PAGES_DIR, pageInfo.file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠ 找不到檔案: ${pageInfo.file}，跳過`);
      continue;
    }

    console.log(`\n📄 處理: ${pageInfo.name} (${pageInfo.file})`);
    const page = await context.newPage();

    try {
      const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
      await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // 等待所有圖片載入
      await page.waitForTimeout(1500);

      // 收集圖片資訊 + 注入標註 overlay
      const imageData = await page.evaluate((colors) => {
        const results = [];
        let index = 0;

        // ====== 1. 處理所有 <img> 標籤 ======
        const imgs = document.querySelectorAll('img');
        imgs.forEach((img) => {
          const rect = img.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(img);

          // 跳過隱藏 / 極小 / SVG 內嵌圖
          if (rect.width < 20 || rect.height < 10) return;
          if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return;
          if (computedStyle.opacity === '0') return;

          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          const src = img.getAttribute('src') || '';
          const alt = img.getAttribute('alt') || '';
          const objectFit = computedStyle.objectFit || 'fill';

          // 取得最近的有意義的 class
          let containerClass = '';
          let el = img.parentElement;
          for (let i = 0; i < 4 && el; i++) {
            if (el.className && typeof el.className === 'string' && el.className.trim()) {
              containerClass = el.className.trim().split(/\s+/)[0];
              break;
            }
            el = el.parentElement;
          }

          const scrollY = window.scrollY;

          results.push({
            type: 'img',
            index: index++,
            width: w,
            height: h,
            top: rect.top + scrollY,
            left: rect.left,
            src: src.split('/').pop(),
            alt,
            objectFit,
            containerClass,
            recommend2x: `${w * 2} × ${h * 2}`,
          });
        });

        // ====== 2. 處理背景圖片 ======
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
          const computedStyle = window.getComputedStyle(el);
          const bgImage = computedStyle.backgroundImage;
          if (!bgImage || bgImage === 'none') return;
          if (!bgImage.includes('url(')) return;
          // 跳過漸變
          if (bgImage.startsWith('linear-gradient') || bgImage.startsWith('radial-gradient')) return;

          const rect = el.getBoundingClientRect();
          if (rect.width < 30 || rect.height < 20) return;
          if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return;

          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          const bgSize = computedStyle.backgroundSize;

          // 取得 URL
          const urlMatch = bgImage.match(/url\(["']?(.+?)["']?\)/);
          const bgUrl = urlMatch ? urlMatch[1].split('/').pop() : '';

          // 跳過極小的重複圖案
          if (bgSize === '24px 24px' || bgSize === '48px 48px') return;

          let containerClass = '';
          if (el.className && typeof el.className === 'string' && el.className.trim()) {
            containerClass = el.className.trim().split(/\s+/)[0];
          }

          const scrollY = window.scrollY;

          results.push({
            type: 'bg',
            index: index++,
            width: w,
            height: h,
            top: rect.top + scrollY,
            left: rect.left,
            src: bgUrl,
            bgSize,
            containerClass,
            recommend2x: `${w * 2} × ${h * 2}`,
          });
        });

        return results;
      }, COLORS);

      // 注入視覺標註到頁面上
      await page.evaluate((data) => {
        const { images, colors } = data;

        // 建立標註容器
        const overlay = document.createElement('div');
        overlay.id = 'image-spec-overlay';
        overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:0;pointer-events:none;z-index:99999;';
        document.body.appendChild(overlay);

        images.forEach((img, idx) => {
          const isImg = img.type === 'img';
          const borderColor = isImg ? colors.imgBorder : colors.bgBorder;
          const labelBg = isImg ? colors.labelBg : colors.bgLabelBg;

          // 邊框高亮
          const border = document.createElement('div');
          border.style.cssText = `
            position: absolute;
            top: ${img.top}px;
            left: ${img.left}px;
            width: ${img.width}px;
            height: ${img.height}px;
            border: 3px solid ${borderColor};
            box-sizing: border-box;
            pointer-events: none;
            z-index: 99999;
          `;
          overlay.appendChild(border);

          // 半透明底色
          const bgTint = document.createElement('div');
          bgTint.style.cssText = `
            position: absolute;
            top: ${img.top}px;
            left: ${img.left}px;
            width: ${img.width}px;
            height: ${img.height}px;
            background: ${isImg ? 'rgba(0,150,255,0.06)' : 'rgba(255,100,0,0.06)'};
            pointer-events: none;
            z-index: 99998;
          `;
          overlay.appendChild(bgTint);

          // 編號圓圈
          const numBadge = document.createElement('div');
          numBadge.style.cssText = `
            position: absolute;
            top: ${img.top + 4}px;
            left: ${img.left + 4}px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: ${labelBg};
            color: #fff;
            font-size: 13px;
            font-weight: bold;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100001;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
          `;
          numBadge.textContent = idx + 1;
          overlay.appendChild(numBadge);

          // 尺寸標籤
          const label = document.createElement('div');
          const labelContent = `${img.width} × ${img.height}`;
          const subInfo = img.src ? img.src : (img.containerClass || '');

          label.style.cssText = `
            position: absolute;
            top: ${img.top + img.height - 36}px;
            left: ${img.left + img.width / 2}px;
            transform: translateX(-50%);
            background: ${labelBg};
            color: #fff;
            padding: 3px 10px;
            border-radius: 4px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            font-weight: bold;
            white-space: nowrap;
            z-index: 100001;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            text-align: center;
            line-height: 1.5;
          `;
          label.innerHTML = `${labelContent}`;
          overlay.appendChild(label);

          // 如果尺寸太大，在頂部也放一個
          if (img.height > 300) {
            const topLabel = document.createElement('div');
            topLabel.style.cssText = `
              position: absolute;
              top: ${img.top + 6}px;
              left: ${img.left + 36}px;
              background: ${labelBg};
              color: #fff;
              padding: 2px 8px;
              border-radius: 3px;
              font-family: 'Consolas', 'Monaco', monospace;
              font-size: 12px;
              white-space: nowrap;
              z-index: 100001;
              box-shadow: 0 1px 4px rgba(0,0,0,0.3);
              opacity: 0.9;
            `;
            topLabel.textContent = subInfo.length > 35 ? subInfo.substring(0, 35) + '…' : subInfo;
            overlay.appendChild(topLabel);
          }
        });

        // 圖例 (Legend)
        const legend = document.createElement('div');
        legend.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background: rgba(30,30,30,0.95);
          color: #fff;
          padding: 14px 18px;
          border-radius: 8px;
          font-family: 'Microsoft JhengHei', Arial, sans-serif;
          font-size: 13px;
          z-index: 100002;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
          line-height: 1.8;
        `;
        legend.innerHTML = `
          <div style="font-size:15px;font-weight:bold;margin-bottom:6px;">圖片素材尺寸標註</div>
          <div><span style="display:inline-block;width:14px;height:14px;background:${colors.imgBorder};border-radius:2px;vertical-align:middle;margin-right:6px;"></span> &lt;img&gt; 圖片</div>
          <div><span style="display:inline-block;width:14px;height:14px;background:${colors.bgBorder};border-radius:2px;vertical-align:middle;margin-right:6px;"></span> 背景圖片 (CSS)</div>
          <div style="margin-top:4px;font-size:12px;color:#bbb;">尺寸為 CSS 顯示尺寸 (px)<br>建議輸出 2x 解析度</div>
        `;
        document.body.appendChild(legend);

      }, { images: imageData, colors: COLORS });

      // 截圖
      const screenshotName = pageInfo.file.replace('.html', '') + '.png';
      const screenshotPath = path.join(OUTPUT_DIR, screenshotName);

      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png',
      });

      console.log(`  ✅ 截圖已儲存: ${screenshotName} (${imageData.length} 個圖片)`);

      allPagesData.push({
        page: pageInfo.name,
        file: pageInfo.file,
        screenshot: screenshotName,
        images: imageData,
      });
    } catch (err) {
      console.error(`  ❌ 處理失敗: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  // 產生總覽 HTML 報告
  generateReport(allPagesData);

  await browser.close();
  console.log(`\n🎉 全部完成！結果已輸出至: image-specs/`);
  console.log(`   📊 開啟 image-specs/index.html 查看互動式報告`);
}

function generateReport(allPagesData) {
  let html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>圖片素材需求總覽 — 大毅建設官網</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Microsoft JhengHei', 'Noto Sans TC', sans-serif; background: #f5f5f5; color: #333; }
  .header { background: linear-gradient(135deg, #194F5B, #2a7a8a); color: #fff; padding: 40px; text-align: center; }
  .header h1 { font-size: 28px; margin-bottom: 8px; }
  .header p { font-size: 14px; opacity: 0.8; }
  .legend-bar { display: flex; justify-content: center; gap: 32px; padding: 16px 20px; background: #fff; border-bottom: 1px solid #e0e0e0; position: sticky; top: 0; z-index: 100; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; }
  .legend-dot { width: 14px; height: 14px; border-radius: 3px; }
  .legend-dot.img { background: rgba(0
, 150, 255, 0.8); }
  .legend-dot.bg { background: rgba(255, 100, 0, 0.85); }
  nav { background: #fff; padding: 16px 40px; display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #e0e0e0; }
  nav a { font-size: 13px; padding: 4px 12px; background: #eee; border-radius: 4px; text-decoration: none; color: #333; transition: all 0.2s; }
  nav a:hover { background: #194F5B; color: #fff; }
  .page-section { max-width: 1600px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .page-title { background: #194F5B; color: #fff; padding: 16px 24px; font-size: 18px; display: flex; justify-content: space-between; align-items: center; }
  .page-title .badge { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 13px; }
  .page-content { display: flex; gap: 0; }
  .page-screenshot { flex: 1; min-width: 0; padding: 16px; overflow: auto; max-height: 800px; background: #fafafa; border-right: 1px solid #e0e0e0; }
  .page-screenshot img { width: 100%; height: auto; display: block; border: 1px solid #ddd; cursor: zoom-in; }
  .page-screenshot img.zoomed { width: auto; max-width: none; cursor: zoom-out; }
  .page-table { width: 480px; flex-shrink: 0; overflow-y: auto; max-height: 800px; }
  .page-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .page-table th { background: #f0f0f0; padding: 10px 12px; text-align: left; font-weight: 600; position: sticky; top: 0; z-index: 1; }
  .page-table td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .page-table tr:hover { background: #f8f9ff; }
  .tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; }
  .tag-img { background: rgba(0,150,255,0.12); color: #0078dc; }
  .tag-bg { background: rgba(255,100,0,0.12); color: #dc5000; }
  .size { font-family: 'Consolas', monospace; font-weight: 600; color: #194F5B; }
  .recommend { font-family: 'Consolas', monospace; color: #c00; font-weight: 600; }
  .filename { font-size: 11px; color: #888; word-break: break-all; }
  .container-class { font-size: 11px; color: #666; background: #f0f0f0; padding: 1px 4px; border-radius: 2px; }
  footer { text-align: center; padding: 32px; font-size: 12px; color: #999; }
</style>
</head>
<body>
<div class="header">
  <h1>📐 圖片素材需求總覽</h1>
  <p>大毅建設官網 — 各頁面圖片尺寸標註 ｜ 產出時間：${new Date().toLocaleDateString('zh-TW')} ${new Date().toLocaleTimeString('zh-TW')}</p>
</div>
<div class="legend-bar">
  <div class="legend-item"><div class="legend-dot img"></div> &lt;img&gt; 圖片元素</div>
  <div class="legend-item"><div class="legend-dot bg"></div> CSS 背景圖片</div>
  <div class="legend-item" style="font-size:12px;color:#999;">尺寸格式：CSS 顯示尺寸 → <span style="color:#c00;font-weight:600;">建議 2x 輸出尺寸</span></div>
</div>
<nav>
  ${allPagesData.map(p => `<a href="#${p.file}">${p.page}</a>`).join('\n  ')}
</nav>
`;

  for (const pageData of allPagesData) {
    const imgCount = pageData.images.filter(i => i.type === 'img').length;
    const bgCount = pageData.images.filter(i => i.type === 'bg').length;

    html += `
<section class="page-section" id="${pageData.file}">
  <div class="page-title">
    <span>${pageData.page} <small style="opacity:0.7;font-size:13px;">(${pageData.file})</small></span>
    <span class="badge">${imgCount} img ＋ ${bgCount} bg</span>
  </div>
  <div class="page-content">
    <div class="page-screenshot">
      <img src="${pageData.screenshot}" alt="${pageData.page} 截圖" onclick="this.classList.toggle('zoomed')">
    </div>
    <div class="page-table">
      <table>
        <thead>
          <tr><th>#</th><th>類型</th><th>CSS 尺寸</th><th>建議 2x</th><th>詳情</th></tr>
        </thead>
        <tbody>
`;

    pageData.images.forEach((img, idx) => {
      const typeTag = img.type === 'img'
        ? '<span class="tag tag-img">IMG</span>'
        : '<span class="tag tag-bg">BG</span>';
      const details = [];
      if (img.src) details.push(`<div class="filename">${img.src}</div>`);
      if (img.containerClass) details.push(`<span class="container-class">.${img.containerClass}</span>`);
      if (img.objectFit && img.objectFit !== 'fill') details.push(`<span class="container-class">${img.objectFit}</span>`);
      if (img.bgSize) details.push(`<span class="container-class">bg-size: ${img.bgSize}</span>`);

      html += `          <tr>
            <td>${idx + 1}</td>
            <td>${typeTag}</td>
            <td class="size">${img.width} × ${img.height}</td>
            <td class="recommend">${img.recommend2x}</td>
            <td>${details.join(' ')}</td>
          </tr>
`;
    });

    html += `        </tbody>
      </table>
    </div>
  </div>
</section>
`;
  }

  html += `
<footer>
  <p>由 Playwright 自動產生 — 尺寸為頁面在 1920 × 1080 視窗下的 CSS 渲染尺寸</p>
  <p>實際輸出圖片建議使用 <strong>2 倍解析度</strong>，以確保 Retina 螢幕清晰度</p>
</footer>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html, 'utf-8');
  console.log('\n📊 HTML 報告已產生: image-specs/index.html');
}

main().catch(console.error);
