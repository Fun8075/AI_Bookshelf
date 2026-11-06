/**
 * 单文件打包：把书架文档打成一个可双击运行、离线可用的 HTML。
 * 用法：npm run build:standalone
 * 产物：上级目录 index.html
 *
 * 处理内容：
 *  1. 抽取文档内的主模块脚本，用 esbuild 打包为内联 IIFE（Three.js 取自 public/vendor，不依赖 node_modules/three）
 *  2. 删除 importmap，替换 module 脚本为内联脚本
 *  3. woff2 字体转 base64，内联进 <style>，替换外部字体链接
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public/landing-pages/complete-shelf-v2.html");
const FONTS_DIR = path.join(ROOT, "public/fonts");
const OUT = path.resolve(ROOT, "..", "index.html");

const THREE_ENTRY = path.join(ROOT, "public/vendor/three/three.module.js");
const THREE_ADDONS = path.join(ROOT, "public/vendor/three/addons");

/** 把 three / three/addons/* 指向本地 vendor 目录 */
const vendorThree = {
  name: "vendor-three",
  setup(builder) {
    builder.onResolve({ filter: /^three$/ }, () => ({ path: THREE_ENTRY }));
    builder.onResolve({ filter: /^three\/addons\// }, (args) => ({
      path: path.join(THREE_ADDONS, args.path.slice("three/addons/".length)),
    }));
  },
};

async function inlineFonts() {
  const css = await fs.readFile(path.join(FONTS_DIR, "fonts.css"), "utf8");
  const blocks = [...css.matchAll(/\/\*\s*(latin(?:-ext)?)\s*\*\/\s*@font-face\s*{([^}]*)}/g)];
  const cache = new Map(); // 同一 woff2 只转一次 base64，避免重复内联
  const groups = new Map(); // 同一字体文件的多条 @font-face 合并成权重区间

  for (const block of blocks) {
    const subset = block[1];
    const body = block[2];
    const family = (body.match(/font-family:\s*([^;]+);/) || [])[1];
    const style = (body.match(/font-style:\s*([^;]+);/) || [])[1] || "normal";
    const weight = parseInt((body.match(/font-weight:\s*(\d+)/) || [])[1] || "400", 10);
    const range = (body.match(/unicode-range:\s*([^;]+);/) || [])[1];
    const url = (body.match(/url\(([^)]+\.woff2)\)/) || [])[1];
    if (!family || !range || !url) continue;

    const key = [family.trim(), style.trim(), range.trim(), url].join("|");
    if (!groups.has(key)) {
      groups.set(key, { family: family.trim(), style: style.trim(), range: range.trim(), url, subset, weights: new Set() });
    }
    groups.get(key).weights.add(weight);
  }

  const parts = ["/* 内联字体（latin / latin-ext），离线可用 */"];
  for (const g of groups.values()) {
    if (!cache.has(g.url)) {
      const buf = await fs.readFile(path.join(FONTS_DIR, g.url));
      cache.set(g.url, `url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2')`);
    }
    const weights = [...g.weights].sort((a, b) => a - b);
    const weightCss = weights.length > 1 ? `${weights[0]} ${weights[weights.length - 1]}` : `${weights[0]}`;

    parts.push(
      `/* ${g.subset} */\n@font-face {\n  font-family: '${g.family}';\n  font-style: ${g.style};\n  font-weight: ${weightCss};\n  font-display: swap;\n  src: ${cache.get(g.url)};\n  unicode-range: ${g.range};\n}`
    );
  }
  return parts.join("\n");
}

async function bundleScript(code) {
  const tmpEntry = path.join(os.tmpdir(), `shelf-standalone-${Date.now()}.js`);
  await fs.writeFile(tmpEntry, code, "utf8");
  try {
    const result = await build({
      entryPoints: [tmpEntry],
      absWorkingDir: ROOT,
      bundle: true,
      format: "iife",
      minify: true,
      target: "es2020",
      write: false,
      logLevel: "warning",
      plugins: [vendorThree],
    });
    // 避免内联脚本提前闭合
    return result.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
  } finally {
    await fs.rm(tmpEntry, { force: true });
  }
}

async function main() {
  const html = await fs.readFile(SRC, "utf8");
  const mod = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!mod) throw new Error("未找到主模块脚本");

  const [bundle, fontsCss] = await Promise.all([bundleScript(mod[1]), inlineFonts()]);

  let out = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, "");
  out = out.replace(
    '<link rel="stylesheet" href="/fonts/fonts.css">',
    () => `<style>\n${fontsCss}\n</style>`
  );
  out = out.replace(mod[0], () => `<script>\n${bundle}\n</script>`);

  await fs.writeFile(OUT, out, "utf8");

  const mb = (n) => (n / 1024 / 1024).toFixed(2) + " MB";
  console.log(`输出: ${OUT}`);
  console.log(`大小: ${mb(Buffer.byteLength(out))}（脚本 ${mb(Buffer.byteLength(bundle))}）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
