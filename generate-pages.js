const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectDir = 'd:/skyeagle/alfazaldental/alfazal_update';
const indexPath = path.join(projectDir, 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

// Global metadata store updated dynamically by updateSEOAndSchema inside Node VM
const metadata = {};
const mockMetaElement = (nameOrProperty) => ({
  setAttribute(attr, value) {
    if (!metadata[nameOrProperty]) metadata[nameOrProperty] = {};
    metadata[nameOrProperty][attr] = value;
  }
});

// Mock browser globals for safe JavaScript execution inside Node VM
const sandbox = {
  window: {},
  document: {
    addEventListener() {},
    title: '',
    getElementById() { return { remove() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } }; },
    createElement() { return { setAttribute() {}, text: '', id: '' }; },
    head: {
      appendChild() {}
    },
    querySelector(selector) {
      const match = selector.match(/\[(name|property)="([^"]+)"\]/);
      if (match) {
        return mockMetaElement(match[2]);
      }
      if (selector.includes('canonical')) {
        return {
          setAttribute(attr, value) {
            metadata['canonical'] = value;
          }
        };
      }
      return { setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } };
    },
    querySelectorAll() { return []; },
    body: { addEventListener() {} }
  },
  navigator: { serviceWorker: { register() {} } },
  localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout() {},
  setInterval() {},
  console: console,
  history: { replaceState() {}, pushState() {} },
  Notification: { requestPermission() { return Promise.resolve('granted'); } },
  addEventListener() {},
  IntersectionObserver: class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  AudioContext: class {
    constructor() {}
    createOscillator() { return { connect() {}, frequency: { value: 0 }, start() {}, stop() {} }; }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    resume() { return Promise.resolve(); }
  },
  webkitAudioContext: class {
    constructor() {}
  }
};
sandbox.window = sandbox;

const context = vm.createContext(sandbox);

// 1. Evaluate seo-data.js first in the sandbox with const rewriting for VM global scope injection
const seoDataPath = path.join(projectDir, 'js', 'seo-data.js');
const seoDataContent = fs.readFileSync(seoDataPath, 'utf8');
let cleanSeoData = seoDataContent;
cleanSeoData = cleanSeoData.replace(/\bconst\s+SERVICES_DATA\b/g, 'window.SERVICES_DATA');
cleanSeoData = cleanSeoData.replace(/\bconst\s+DOCTORS_DATA\b/g, 'window.DOCTORS_DATA');
cleanSeoData = cleanSeoData.replace(/\bconst\s+BLOG_POSTS\b/g, 'window.BLOG_POSTS');
vm.runInContext(cleanSeoData, context);
console.log('Successfully evaluated external seo-data.js inside VM context.');

// 2. Extract and evaluate script blocks from index.html
const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let match;
while ((match = scriptRegex.exec(indexContent)) !== null) {
  const attrs = match[1];
  const code = match[2];
  if (attrs.includes('application/ld+json')) continue;
  if (attrs.includes('seo-data.js')) continue;

  let cleanCode = code;
  cleanCode = cleanCode.replace(/^\s*import\b[\s\S]*?from\s+['"].*?['"];?/gm, '// import');
  cleanCode = cleanCode.replace(/^\s*export\b/gm, '// export');
  cleanCode = cleanCode.replace(/\bconst\s+pageRoutes\b/g, 'window.pageRoutes');
  cleanCode = cleanCode.replace(/\bconst\s+seoMapping\b/g, 'window.seoMapping');

  try {
    vm.runInContext(cleanCode, context);
  } catch (err) {
    // Ignore runtime exceptions from DOM setups or dynamic features
  }
}

// Retrieve evaluated configurations
const pageRoutes = sandbox.pageRoutes;

if (!pageRoutes || !sandbox.updateSEOAndSchema) {
  console.error('Could not extract pageRoutes or updateSEOAndSchema from script blocks!');
  process.exit(1);
}

// Dynamically augment pageRoutes with any missing items from external seo-data.js
if (sandbox.SERVICES_DATA) {
  Object.keys(sandbox.SERVICES_DATA).forEach(slug => {
    if (!pageRoutes[slug]) {
      // Setup keyword-rich SEO friendly routes for services
      if (slug === 'root-canal-johar-town-lahore') pageRoutes[slug] = '/treatments/root-canal';
      else if (slug === 'teeth-whitening-lahore') pageRoutes[slug] = '/treatments/teeth-whitening';
      else if (slug === 'dental-implants-lahore') pageRoutes[slug] = '/treatments/dental-implants';
      else if (slug === 'braces-lahore') pageRoutes[slug] = '/treatments/braces';
      else if (slug === 'general-physician-johar-town') pageRoutes[slug] = '/services/medical';
      else pageRoutes[slug] = '/' + slug;
    }
  });
}

if (sandbox.DOCTORS_DATA) {
  Object.keys(sandbox.DOCTORS_DATA).forEach(slug => {
    if (!pageRoutes[slug]) {
      pageRoutes[slug] = '/doctors/' + slug;
    }
  });
}

if (sandbox.BLOG_POSTS) {
  sandbox.BLOG_POSTS.forEach(post => {
    const routeId = 'blog-' + post.id;
    if (!pageRoutes[routeId]) {
      pageRoutes[routeId] = '/blog/' + post.id;
    }
  });
}

console.log('Successfully extracted and augmented pageRoutes mapping. Preparing multi-page pre-rendering...');

const sitemapUrls = [];
const today = new Date().toISOString().split('T')[0];

// Process each route defined in pageRoutes
Object.entries(pageRoutes).forEach(([pageId, routePath]) => {
  const isHome = pageId === 'home';

  // 1. Reset metadata capture variables before running page logic
  for (let key in metadata) delete metadata[key];
  sandbox.document.title = '';

  // 2. Trigger the page's original schema/SEO injector inside the VM context to fetch title and desc
  try {
    sandbox.updateSEOAndSchema(pageId);
  } catch (err) {
    console.warn(`Warning running updateSEOAndSchema for ${pageId}:`, err.message);
  }

  // 3. Fallback check for title and desc if the DOM mock wasn't fully hit
  const title = sandbox.document.title || "Al-Fazal Hospital | Best Dental Clinic in Johar Town, Lahore";
  const desc = (metadata['description'] && metadata['description'].content) || 
               "Al-Fazal Medical & Dental Hospital in BOR Society, Johar Town, Lahore.";
  const canonicalUrl = metadata['canonical'] || `https://www.al-fazalhospital.com${routePath === '/' ? '' : routePath}`;

  // Collect for Sitemap
  let priority = '0.7';
  if (isHome) priority = '1.0';
  else if (['about', 'dental-services', 'medical-services', 'doctors', 'blog', 'contact'].includes(pageId)) priority = '0.8';
  
  sitemapUrls.push({
    path: routePath,
    priority: priority
  });

  // Start building page output from index.html template
  let pageHtml = indexContent;

  // 4. Inject specific SEO metadata into HTML headers
  pageHtml = pageHtml.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  
  pageHtml = pageHtml.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${desc}">`
  );
  
  pageHtml = pageHtml.replace(
    /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${canonicalUrl}">`
  );

  pageHtml = pageHtml.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${title}">`
  );
  
  pageHtml = pageHtml.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${desc}">`
  );
  
  pageHtml = pageHtml.replace(
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${canonicalUrl}">`
  );

  pageHtml = pageHtml.replace(
    /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${title}">`
  );
  
  pageHtml = pageHtml.replace(
    /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${desc}">`
  );
  
  pageHtml = pageHtml.replace(
    /<meta name="twitter:url" content="[^"]*">/,
    `<meta name="twitter:url" content="${canonicalUrl}">`
  );

  // 5. Adjust page-specific active/inactive container styles in source HTML to prevent layout shift on load
  if (!isHome) {
    // Disable home page
    pageHtml = pageHtml.replace('id="pg-home" class="pg active"', 'id="pg-home" class="pg"');
    pageHtml = pageHtml.replace('id="pg-home" class="pg active active-page"', 'id="pg-home" class="pg"');
    
    // Determine mapping target container pageId
    let finalPageId = pageId;
    if (sandbox.SERVICES_DATA && sandbox.SERVICES_DATA[pageId]) {
      finalPageId = 'service-detail';
    } else if (sandbox.DOCTORS_DATA && sandbox.DOCTORS_DATA[pageId]) {
      finalPageId = 'doctor-detail';
    } else if (pageId.startsWith('blog-')) {
      finalPageId = 'blog-detail';
    } else if (pageId === 'blog') {
      finalPageId = 'blogs';
    }

    // Enable target page container
    const targetPattern = `id="pg-${finalPageId}" class="pg"`;
    if (pageHtml.includes(targetPattern)) {
      pageHtml = pageHtml.replace(targetPattern, `id="pg-${finalPageId}" class="pg active active-page"`);
    } else {
      const targetPatternWithStyle = `id="pg-${finalPageId}" class="pg" style="display:none;"`;
      if (pageHtml.includes(targetPatternWithStyle)) {
        pageHtml = pageHtml.replace(targetPatternWithStyle, `id="pg-${finalPageId}" class="pg active active-page"`);
      } else {
        const targetPatternWithStyleDisplay = `id="pg-${finalPageId}" class="pg" style="display:none"`;
        pageHtml = pageHtml.replace(targetPatternWithStyleDisplay, `id="pg-${finalPageId}" class="pg active active-page"`);
      }
    }
  }

  // Normalize line endings to CRLF
  pageHtml = pageHtml.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

  if (isHome) {
    // Overwrite the root index.html with the pre-rendered homepage
    fs.writeFileSync(indexPath, pageHtml, 'utf8');
    console.log(`Pre-rendered Home -> /index.html`);
  } else {
    // Create page-specific subdirectory and write pre-rendered index.html
    const relativeFolder = routePath.startsWith('/') ? routePath.substring(1) : routePath;
    const dirPath = path.join(projectDir, relativeFolder);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(path.join(dirPath, 'index.html'), pageHtml, 'utf8');
    console.log(`Pre-rendered Route: ${routePath} -> /${relativeFolder}/index.html`);
  }
});

// Write Sitemap XML file
const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url>
    <loc>https://www.al-fazalhospital.com${u.path === '/' ? '' : u.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync(path.join(projectDir, 'sitemap-pages.xml'), sitemapContent, 'utf8');
console.log('Pre-rendered Sitemap -> /sitemap-pages.xml');

console.log('✅ Multi-page pre-rendering build successfully completed!');
