"use strict";

function qs(key) {
  return new URLSearchParams(location.search).get(key);
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("加载失败: " + url);
  return res.json();
}

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("加载失败: " + url);
  return res.text();
}

/* ---------- 首页: 书籍卡片 ---------- */
async function initBookList() {
  const el = document.getElementById("bookList");
  try {
    const books = await getJSON("data/books.json");
    el.innerHTML = books.map((b) => `
      <a class="book-card" href="book.html?id=${encodeURIComponent(b.id)}">
        <h2>${b.title}</h2>
        <p class="book-author">${b.author || ""}</p>
        <p class="book-desc">${b.desc || ""}</p>
        <span class="book-meta">${b.chapters.length} 个章节 →</span>
      </a>`).join("");
  } catch (e) {
    el.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

/* ---------- 书籍页: 章节列表 ---------- */
async function initChapterList() {
  const id = qs("id");
  const el = document.getElementById("chapterList");
  try {
    const books = await getJSON("data/books.json");
    const book = books.find((b) => b.id === id);
    if (!book) throw new Error("没有找到这本书");
    document.title = book.title + " · 我的读书笔记";
    document.getElementById("bookTitle").textContent = book.title;
    document.getElementById("bookAuthor").textContent = book.author || "";
    el.innerHTML = book.chapters.map((c, i) => `
      <a class="chapter-item" href="chapter.html?book=${encodeURIComponent(id)}&chapter=${encodeURIComponent(c.file)}">
        <span class="chapter-index">${String(i + 1).padStart(2, "0")}</span>
        <span class="chapter-name">${c.title}</span>
      </a>`).join("");
  } catch (e) {
    el.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

/* ---------- 章节页: 句子 + 悬停卡片 ---------- */
async function initChapter() {
  const bookId = qs("book");
  const file = qs("chapter");
  const el = document.getElementById("noteList");
  try {
    const md = await getText("data/" + bookId + "/" + file);
    const { title, notes } = parseChapter(md);
    document.getElementById("chapterTitle").textContent = title;
    document.getElementById("backToBook").href = "book.html?id=" + encodeURIComponent(bookId);
    el.innerHTML = notes.map((n, i) => `
      <div class="note">
        <span class="note-quote" data-i="${i}">${marked.parseInline(n.quote)}</span>
      </div>`).join("") || `<p class="empty">这个章节还没有笔记</p>`;
    window.__notes = notes;
    bindHoverCard();
  } catch (e) {
    el.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

/* 解析: > 引用 = 提炼句, 其后内容 = 卡片详情 */
function parseChapter(md) {
  const tokens = marked.lexer(md);
  let title = null;
  const notes = [];
  let quote = null;
  let detailTokens = [];
  for (const t of tokens) {
    if (t.type === "heading" && t.depth === 1) {
      title = t.text;
    } else if (t.type === "blockquote") {
      if (quote) notes.push({ quote, detail: marked.parser(detailTokens) });
      quote = t.text.replace(/\n/g, " ").trim();
      detailTokens = [];
    } else if (quote && t.type !== "hr" && t.type !== "space") {
      detailTokens.push(t);
    }
  }
  if (quote) notes.push({ quote, detail: marked.parser(detailTokens) });
  return { title, notes };
}

/* 悬停/点击 弹出详情卡片 */
function bindHoverCard() {
  const card = document.getElementById("detailCard");
  const quotes = document.querySelectorAll(".note-quote");

  function show(n, x, y) {
    card.innerHTML = n.detail;
    card.hidden = false;
    move(x, y);
  }
  function move(x, y) {
    const pad = 16;
    let left = x + pad;
    let top = y + pad;
    if (left + card.offsetWidth > window.innerWidth - 8) left = x - card.offsetWidth - pad;
    if (top + card.offsetHeight > window.innerHeight - 8) top = y - card.offsetHeight - pad;
    card.style.left = Math.max(8, left) + "px";
    card.style.top = Math.max(8, top) + "px";
  }

  quotes.forEach((el) => {
    el.addEventListener("mouseenter", () => {
      const r = el.getBoundingClientRect();
      show(window.__notes[+el.dataset.i], r.left, r.bottom);
    });
    el.addEventListener("mousemove", (e) => { if (!card.hidden) move(e.clientX, e.clientY); });
    el.addEventListener("mouseleave", () => { card.hidden = true; });
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (card.hidden) show(window.__notes[+el.dataset.i], e.clientX, e.clientY);
      else card.hidden = true;
    });
  });

  document.addEventListener("click", () => { card.hidden = true; });
}