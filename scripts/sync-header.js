// /scripts/sync-header.js
const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'index.html',
  'insights/index.html',
  'cases/index.html',
  'insights/drawing-to-production/index.html',
  'insights/component-requirements-equipment-performance/index.html',
  'insights/replacement-parts-reliable-repeat-supply/index.html',
  'insights/precision-component-process-development/index.html',
  'cases/434mm-long-sleeve-concentricity/index.html',
  'cases/precision-components-for-cnc-spring-machine/index.html',
  'cases/welding-locating-pins-replacement-supply/index.html',
  'cases/precision-mirror-finish-eccentric-shaft/index.html'
];

const headerPartialPath = path.join(__dirname, '../components/header.html');

let headerTemplate = '';
try {
  headerTemplate = fs.readFileSync(headerPartialPath, 'utf8');
} catch (err) {
  console.error(`Error reading header template: ${err.message}`);
  process.exit(1);
}

const cssBlock = `
/* ===== Shared Header Sync ===== */
header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--border-light);
  background: #ffffff;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 14px 20px;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;
}

.brand-logo {
  height: 30px;
  width: auto;
  object-fit: contain;
  display: block;
  flex-shrink: 0;
}

.brand-text-main {
  font-weight: 700;
  font-size: 16px;
  line-height: 1.2;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-dark);
  white-space: nowrap;
}

.nav-links {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: center;
  margin: 0 24px;
}

.nav-links a {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-dark);
  transition: color 0.2s, border-color 0.2s;
  padding: 8px 0 7px;
  border-bottom: 2px solid transparent;
  line-height: 1.2;
}

.nav-links a:hover {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.nav-links a.nav-active {
  color: var(--text-dark);
  font-weight: 700;
  border-bottom-color: var(--accent);
}

.header-cta {
  display: inline-block;
  flex-shrink: 0;
  white-space: nowrap;
  width: auto;
  min-width: max-content;
  padding: 10px 20px;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
  background: var(--accent);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 6px -1px rgba(249, 115, 22, 0.2);
}

.header-cta:hover {
  background: #ea580c;
  color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 6px 8px -1px rgba(249, 115, 22, 0.3);
}

@media (max-width: 900px) {
  .nav-links {
    display: none;
  }
}

@media (max-width: 480px) {
  .header-inner {
    padding-left: 12px;
    padding-right: 12px;
    gap: 10px;
  }

  .brand-text-main {
    font-size: 14px;
  }

  .brand-logo {
    height: 26px;
  }

  .header-cta {
    padding: 9px 12px;
    font-size: 12px;
  }
}
/* ===== End Shared Header Sync ===== */
`;

filesToProcess.forEach(filePath => {
  const fullPath = path.join(__dirname, '../', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`Warning: File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  const isHome = filePath === 'index.html';
  const isInsights = filePath.startsWith('insights/');
  const isCases = filePath.startsWith('cases/');
  
  const depth = filePath.split('/').length - 1;
  let depthStr = '';
  for (let i = 0; i < depth; i++) {
    depthStr += '../';
  }

  const COMP_URL = isHome ? '#components' : '/#components';
  const COMP_ATTR = isHome ? '' : ' data-home-anchor="components"';
  
  const IND_URL = isHome ? '#industries' : '/#industries';
  const IND_ATTR = isHome ? '' : ' data-home-anchor="industries"';
  
  const MAN_URL = isHome ? '#manufacturing' : '/#manufacturing';
  const MAN_ATTR = isHome ? '' : ' data-home-anchor="manufacturing"';
  
  const QUA_URL = isHome ? '#quality' : '/#quality';
  const QUA_ATTR = isHome ? '' : ' data-home-anchor="quality"';
  
  const CON_URL = isHome ? '#contact' : '/#contact';
  const CON_ATTR = isHome ? '' : ' data-home-anchor="contact"';
  
  const HOME_LINK_ATTR = ' data-home-link';
  const LOGO_LOCAL_ATTR = ` data-local-src="${depthStr}images/gf2.png"`;
  
  const INSIGHTS_LOCAL_ATTR = ` data-local-href="${depthStr}insights/index.html"`;
  const CASES_LOCAL_ATTR = ` data-local-href="${depthStr}cases/index.html"`;
  
  const INSIGHTS_CLASS = isInsights && !isHome ? ' class="nav-active"' : '';
  const CASES_CLASS = isCases && !isHome ? ' class="nav-active"' : '';

  const newHeader = headerTemplate
    .replace(/{{HOME_LINK_ATTR}}/g, HOME_LINK_ATTR)
    .replace(/{{LOGO_LOCAL_ATTR}}/g, LOGO_LOCAL_ATTR)
    .replace(/{{COMPONENTS_URL}}/g, COMP_URL)
    .replace(/{{COMPONENTS_ATTR}}/g, COMP_ATTR)
    .replace(/{{INDUSTRIES_URL}}/g, IND_URL)
    .replace(/{{INDUSTRIES_ATTR}}/g, IND_ATTR)
    .replace(/{{MANUFACTURING_URL}}/g, MAN_URL)
    .replace(/{{MANUFACTURING_ATTR}}/g, MAN_ATTR)
    .replace(/{{QUALITY_URL}}/g, QUA_URL)
    .replace(/{{QUALITY_ATTR}}/g, QUA_ATTR)
    .replace(/{{INSIGHTS_LOCAL_ATTR}}/g, INSIGHTS_LOCAL_ATTR)
    .replace(/{{INSIGHTS_CLASS}}/g, INSIGHTS_CLASS)
    .replace(/{{CASES_LOCAL_ATTR}}/g, CASES_LOCAL_ATTR)
    .replace(/{{CASES_CLASS}}/g, CASES_CLASS)
    .replace(/{{CONTACT_URL}}/g, CON_URL)
    .replace(/{{CONTACT_ATTR}}/g, CON_ATTR);

  if (!/<header>[\s\S]*?<\/header>/.test(content)) {
    console.warn(`Warning: <header> block not found in ${filePath}`);
  } else {
    content = content.replace(/<header>[\s\S]*?<\/header>/, newHeader);
  }

  if (!/<style>/.test(content)) {
    console.warn(`Warning: <style> block not found in ${filePath}`);
  } else {
    const cssRegex = /\/\* ===== Shared Header Sync ===== \*\/[\s\S]*?\/\* ===== End Shared Header Sync ===== \*\//;
    if (cssRegex.test(content)) {
      content = content.replace(cssRegex, cssBlock.trim());
    } else {
      content = content.replace(/<\/style>/, `\n  ${cssBlock.trim()}\n  </style>`);
    }
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated: /${filePath}`);
});

console.log('Header sync complete.');