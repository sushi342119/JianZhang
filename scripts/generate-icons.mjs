import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = process.cwd();
const designDir = path.join(root, 'design');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');

const fontFiles = [
  'C:/Windows/Fonts/msyh.ttc',
  'C:/Windows/Fonts/msyhbd.ttc',
].filter((f) => fs.existsSync(f));

function renderSvgToPng(svgContent, width, outPath) {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: width },
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: 'Microsoft YaHei',
    },
  });
  const pngData = resvg.render().asPng();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pngData);
}

// Master SVG builders for Scheme A (Obsidian), Scheme B (Porcelain), Scheme C (Jade)
const iconAMotif = `
  <g transform="rotate(-8 242 250)">
    <rect x="148" y="140" width="196" height="212" rx="40" fill="url(#cardBackA)" opacity="0.92"/>
  </g>
  <rect x="148" y="156" width="212" height="212" rx="43" fill="#FAFAFA"/>
  <path d="M192 280 L230 244 L258 266 L306 214" fill="none" stroke="#141417" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="192" y1="320" x2="268" y2="320" stroke="#D4D4D8" stroke-width="15" stroke-linecap="round"/>
  <path d="M358 104 C358 131 365 138 392 138 C365 138 358 145 358 172 C358 145 351 138 324 138 C351 138 358 131 358 104 Z" fill="#34D399"/>
`;

function buildIconASvg(shape = 'squircle') {
  const rx = shape === 'circle' ? 256 : shape === 'FullSquare' ? 0 : 114;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="bgA" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#222228"/>
        <stop offset="100%" stop-color="#111114"/>
      </linearGradient>
      <linearGradient id="cardBackA" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#34D399"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>
    </defs>
    ${shape === 'foreground' ? '' : `<rect width="512" height="512" rx="${rx}" fill="url(#bgA)"/>`}
    ${iconAMotif}
  </svg>`;
}

const svgA = buildIconASvg('squircle');
const svgB = fs.readFileSync(path.join(designDir, 'icon-b-porcelain.svg'), 'utf8');
const svgC = fs.readFileSync(path.join(designDir, 'icon-c-jade.svg'), 'utf8');

// Save updated svgA & favicon
fs.writeFileSync(path.join(designDir, 'icon-a-obsidian.svg'), svgA, 'utf8');
fs.writeFileSync(path.join(root, 'public', 'favicon.svg'), svgA, 'utf8');

// Render 512px individual PNGs
renderSvgToPng(svgA, 512, path.join(designDir, 'icon-a-obsidian.png'));
renderSvgToPng(svgB, 512, path.join(designDir, 'icon-b-porcelain.png'));
renderSvgToPng(svgC, 512, path.join(designDir, 'icon-c-jade.png'));

// Build 1380x580 Showcase Comparison Sheet SVG
function embedInner(svgStr) {
  return svgStr
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
}

const showcaseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1380 560" width="1380" height="560">
  <rect width="1380" height="560" rx="32" fill="#F4F4F6"/>
  <text x="690" y="58" text-anchor="middle" font-family="Microsoft YaHei" font-size="26" font-weight="bold" fill="#18181B">「简账」极简应用图标设计方案</text>
  <text x="690" y="90" text-anchor="middle" font-family="Microsoft YaHei" font-size="15" fill="#71717A">兼顾日常账本 · 工时补贴 · 会员订阅 · AI 快记四重意象，克制留白不杂乱</text>

  <!-- Card 1 -->
  <rect x="55" y="122" width="390" height="392" rx="28" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="2"/>
  <rect x="175" y="140" width="150" height="26" rx="13" fill="#ECFDF5"/>
  <text x="250" y="158" text-anchor="middle" font-family="Microsoft YaHei" font-size="13" font-weight="bold" fill="#059669">方案一 · 默认已应用</text>
  <svg x="150" y="184" width="200" height="200" viewBox="0 0 512 512">${embedInner(svgA)}</svg>
  <text x="250" y="426" text-anchor="middle" font-family="Microsoft YaHei" font-size="20" font-weight="bold" fill="#18181B">曜石星账</text>
  <text x="250" y="456" text-anchor="middle" font-family="Microsoft YaHei" font-size="13.5" fill="#71717A">黑曜石底 + 双层错位卡 + 结余折线 + AI星芒</text>
  <text x="250" y="480" text-anchor="middle" font-family="Microsoft YaHei" font-size="12.5" fill="#A1A1AA">现代深邃，浅色/深色手机壁纸皆百搭</text>

  <!-- Card 2 -->
  <rect x="495" y="122" width="390" height="392" rx="28" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="2"/>
  <rect x="595" y="140" width="190" height="26" rx="13" fill="#F4F4F5"/>
  <text x="690" y="158" text-anchor="middle" font-family="Microsoft YaHei" font-size="13" font-weight="bold" fill="#52525B">方案二 · 东方留白</text>
  <rect x="589" y="183" width="202" height="202" rx="46" fill="none" stroke="#E4E4E7" stroke-width="2"/>
  <svg x="590" y="184" width="200" height="200" viewBox="0 0 512 512">${embedInner(svgB)}</svg>
  <text x="690" y="426" text-anchor="middle" font-family="Microsoft YaHei" font-size="20" font-weight="bold" fill="#18181B">白瓷方印</text>
  <text x="690" y="456" text-anchor="middle" font-family="Microsoft YaHei" font-size="13.5" fill="#71717A">温润羊脂白底 + 抽象「简」字竹简账册 + 朱砂印</text>
  <text x="690" y="480" text-anchor="middle" font-family="Microsoft YaHei" font-size="12.5" fill="#A1A1AA">书卷气十足，在花哨桌面图标里极显干净</text>

  <!-- Card 3 -->
  <rect x="935" y="122" width="390" height="392" rx="28" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="2"/>
  <rect x="1035" y="140" width="190" height="26" rx="13" fill="#F0FDFA"/>
  <text x="1130" y="158" text-anchor="middle" font-family="Microsoft YaHei" font-size="13" font-weight="bold" fill="#0D9488">方案三 · 清新几何</text>
  <svg x="1030" y="184" width="200" height="200" viewBox="0 0 512 512">${embedInner(svgC)}</svg>
  <text x="1130" y="426" text-anchor="middle" font-family="Microsoft YaHei" font-size="20" font-weight="bold" fill="#18181B">松石三合</text>
  <text x="1130" y="456" text-anchor="middle" font-family="Microsoft YaHei" font-size="13.5" fill="#71717A">松石青绿底 + 工时/订阅/账本三模块秩序聚合</text>
  <text x="1130" y="480" text-anchor="middle" font-family="Microsoft YaHei" font-size="12.5" fill="#A1A1AA">清新柔和有活力，直观体现三合一理念</text>
</svg>`;

renderSvgToPng(showcaseSvg, 1380, path.join(designDir, '简账图标方案对比.png'));

// Generate all Android mipmap PNG densities for Scheme A
const mipmaps = [
  { folder: 'mipmap-mdpi', launcher: 48, fg: 108 },
  { folder: 'mipmap-hdpi', launcher: 72, fg: 162 },
  { folder: 'mipmap-xhdpi', launcher: 96, fg: 216 },
  { folder: 'mipmap-xxhdpi', launcher: 144, fg: 324 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, fg: 432 },
];

const svgARound = buildIconASvg('circle');
const svgAFg = buildIconASvg('foreground');

for (const m of mipmaps) {
  const dir = path.join(resDir, m.folder);
  renderSvgToPng(svgA, m.launcher, path.join(dir, 'ic_launcher.png'));
  renderSvgToPng(svgARound, m.launcher, path.join(dir, 'ic_launcher_round.png'));
  renderSvgToPng(svgAFg, m.fg, path.join(dir, 'ic_launcher_foreground.png'));
}

// Replace all Capacitor default blue splash.png files with clean minimalist obsidian splash
const splashFolders = fs
  .readdirSync(resDir)
  .filter((name) => name.startsWith('drawable') && fs.existsSync(path.join(resDir, name, 'splash.png')));

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#141417"/>
  <svg x="412" y="780" width="256" height="256" viewBox="0 0 512 512">${embedInner(svgAFg)}</svg>
</svg>`;

for (const sf of splashFolders) {
  renderSvgToPng(splashSvg, 720, path.join(resDir, sf, 'splash.png'));
}

console.log('Generated showcase PNG, 5 mipmap densities, and', splashFolders.length, 'splash screens.');
