
/* =========================================================
   James Gaze
   LP.js — V9

   LP1 / LP2 / LP3 共用邏輯
   獨立於 script.js 之外，只處理三個課程頁才有的元件。

   架構
   ---------------------------------------------------------
   01. Global State
   02. CTA Form Links
   03. Accordion（Lesson / FAQ 共用；LP3 Chapter 手風琴、
       Lesson 純文字不參與此邏輯）
   04. How Section 圖片淡入淡出（image-2 疊在 image-1 上）
   05. Ability Mobile Dots
   06. Scroll Reveal（滾動淡入，進場一次性效果）
   07. Lesson 圖片「跟隨捲動、碰底就停」（Desktop/Tablet only）
   08. Info Card 持續視差（背景/卡片不同速度、方向）
   09. Initialization
   ========================================================= */


document.addEventListener("DOMContentLoaded", () => {


    /* =====================================================
       01. GLOBAL STATE
       ===================================================== */

    const state = {

        prefersReducedMotion:
            window.matchMedia &&
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches

    };



    /* =====================================================
       02. CTA FORM LINKS

       所有「立即報名」按鈕都是：

       <a class="lp-cta-link" data-form-key="lp1" href="#">

       正式 Google 表單網址集中寫在這裡，
       之後只需要改這個 config，
       不用回頭改任何一個 HTML 檔案。
       ===================================================== */

    const CTA_FORM_CONFIG = {

        lp1: "register.html?course=lp1",
        lp2: "register.html?course=lp2",
        lp3: "register.html?course=lp3"

    };

    function initCtaLinks() {

        const links =
            document.querySelectorAll(
                "[data-form-key]"
            );


        if (!links.length) {

            return;

        }


        links.forEach(
            (link) => {

                const key =
                    link.getAttribute(
                        "data-form-key"
                    );


                const url =
                    CTA_FORM_CONFIG[key];


                if (!url) {

                    /*
                        還沒有正式表單網址時，
                        不要讓按鈕變成死連結，
                        用 console 提醒開發者即可。
                    */

                    console.warn(
                        "[LP.js] 尚未設定 data-form-key=\"" +
                        key +
                        "\" 對應的 Google 表單網址"
                    );

                    return;

                }


                link.setAttribute("href", url);

                link.removeAttribute("target");
                link.removeAttribute("rel");
            }
        );

    }

/* =====================================================
       02B. SESSION INFO
       把系統資料接到課程頁：

       1. info card 的 開課日／剩餘名額／報名截止日
       2. 所有「立即報名」按鈕的文字與狀態
          open     → 立即報名
          waitlist → 登記候補
          其他     → 目前未開放報名（按鈕停用）

       資料來源：Apps Script API（和報名頁同一支）
       讀取失敗時：先顯示 30 分鐘內的上次資料；
       沒有上次資料才顯示備用文字。
       ===================================================== */

    const SESSION_API_URL =
        "https://script.google.com/macros/s/AKfycbwC-LG0gskNwglEwla2FloU5rr2MiMkKCq9srZz92iKzOHgFOsVSNzVvh8DANPHbwbxMw/exec";

    const SESSION_TIMEOUT_MS = 20000;

    const SESSION_CACHE_KEY = "lp_sessions_cache_v1";

    const SESSION_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

    const SESSION_TEXT = {

        loading: "載入中…",

        failSeats: "名額資訊暫時無法載入",

        failOther: "請洽詢",

        noneSeats: "目前沒有開放報名的梯次",

        noneDate: "尚未公布",

        noneDeadline: "—",

        ctaWaitlist: "登記候補",

        ctaClosed: "目前未開放報名"

    };


    function sessionCourseCode() {

        const first =
            document.querySelector("[data-form-key]");

        return first
            ? first.getAttribute("data-form-key").toUpperCase()
            : "";

    }


    function readSessionCache() {

        try {

            const raw =
                localStorage.getItem(SESSION_CACHE_KEY);

            if (!raw) {
                return null;
            }

            const c = JSON.parse(raw);

            if (
                !c ||
                !Array.isArray(c.sessions) ||
                Date.now() - c.savedAt > SESSION_CACHE_MAX_AGE_MS
            ) {
                return null;
            }

            return { sessions: c.sessions, params: c.params || null, reviews: c.reviews || null };

        } catch (e) {

            return null;

        }

    }


    function writeSessionCache(data) {

        try {

            localStorage.setItem(
                SESSION_CACHE_KEY,
                JSON.stringify({
                    savedAt: Date.now(),
                    sessions: data.sessions,
                    params: data.params || null,
                    reviews: data.reviews || null
                })
            );

        } catch (e) {
            /* 儲存失敗不影響頁面 */
        }

    }


    async function fetchSessionsOnce() {

        const ctrl = new AbortController();

        const timer = setTimeout(
            () => ctrl.abort(),
            SESSION_TIMEOUT_MS
        );

        try {

            const res = await fetch(
                SESSION_API_URL + "?action=sessions",
                { signal: ctrl.signal }
            );

            if (!res.ok) {
                throw new Error("HTTP " + res.status);
            }

            const data = await res.json();

            if (!data.ok || !Array.isArray(data.sessions)) {
                throw new Error("API 回傳失敗");
            }

            return { sessions: data.sessions, params: data.params || null, reviews: data.reviews || null };

        } finally {

            clearTimeout(timer);

        }

    }


    async function fetchSessions() {

        let lastErr;

        for (let i = 0; i < 2; i++) {

            try {
                return await fetchSessionsOnce();
            } catch (err) {
                lastErr = err;
            }

        }

        throw lastErr;

    }


    // 這堂課「最近一個還能報名的梯次」（正取或候補都算）
    function pickSession(all, course) {

        const mine = all
            .filter((s) => s.course === course)
            .sort((a, b) =>
                a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)
            );

        const open = mine.find(
            (s) => s.status === "open" || s.status === "waitlist"
        );

        return { picked: open || null, total: mine.length };

    }


    function setInfoField(name, text) {

        document
            .querySelectorAll('[data-session-field="' + name + '"]')
            .forEach((node) => {
                node.textContent = text;
            });

    }


    function slashDate(iso) {

        return String(iso).replace(/-/g, "/");

    }


    function updateCtaButtons(picked, course) {

        const code = course.toLowerCase();

        document
            .querySelectorAll(".lp-cta-link")
            .forEach((link) => {

                // 第一次記住原本的按鈕文字
                if (!link.hasAttribute("data-cta-label")) {
                    link.setAttribute(
                        "data-cta-label",
                        link.textContent.trim()
                    );
                }

                const original = link.getAttribute("data-cta-label");

                if (!picked) {

                    link.textContent = SESSION_TEXT.ctaClosed;
                    link.classList.add("is-disabled");
                    link.setAttribute("aria-disabled", "true");
                    link.setAttribute("tabindex", "-1");
                    link.removeAttribute("href");

                    return;

                }

                link.classList.remove("is-disabled");
                link.removeAttribute("aria-disabled");
                link.removeAttribute("tabindex");

                link.textContent =
                    picked.status === "waitlist"
                        ? SESSION_TEXT.ctaWaitlist
                        : original;

                // 帶上梯次，報名頁會直接選好這一梯
                link.setAttribute(
                    "href",
                    "register.html?course=" + code +
                    "&session=" + encodeURIComponent(picked.id)
                );

            });

    }


    // 頁面上的數字（小班人數、開課人數、價格、截止天數、截止後退費金額）
    // 一律讀 API（來源是 Sheet 的「梯次」與「設定」分頁），不寫死。
    // HTML 寫成 <span data-term="minPeople">3</span>，括號內的字是讀取失敗時的備用。
    function fmtRefundTerm(n) {

        const v = Number(n) || 0;

        return v === 0 ? "0 元" : "NT$" + v.toLocaleString("en-US");

    }


    function applyTerms(all, params, course, picked) {

        if (!params) {
            return;
        }

        // 人數上限：優先用這次顯示的梯次，沒有就用這堂課最近的一梯
        const mine = all
            .filter((s) => s.course === course)
            .sort((a, b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)));

        const ref = picked || mine[0] || null;

        // 新版 API 的 minPeople、refundStartSeq 是「各課程一個數字」的物件；舊版是單一數字，兩種都能讀
        const perCourse = (v) => (
            v && typeof v === "object" ? (course in v ? v[course] : null) : v
        );

        const pct = params.refundPct && course in params.refundPct
            ? Number(params.refundPct[course]) : null;

        const price = params.price && course in params.price
            ? Number(params.price[course]) : null;

        const values = {
            minPeople: perCourse(params.minPeople),
            deadlineDays: params.deadlineDays,
            deadlineDayN: params.deadlineDays ? Number(params.deadlineDays) + 1 : null,
            mainCap: ref ? ref.mainCap : null,
            waitCap: ref ? ref.waitCap : null,
            refundAfter: params.refundAfter && course in params.refundAfter
                ? fmtRefundTerm(params.refundAfter[course]) : null,
            refundPct: pct !== null ? pct + "%" : null,
            // 比例為 0 → 「不退費」；否則「退還學費的 50%（NT$10,000）」
            refundText: pct === null || !price ? null : (
                pct === 0 ? "不退費"
                    : "退還學費的 " + pct + "%（NT$" +
                      Math.round(price * pct / 100).toLocaleString("en-US") + "）"
            ),
            refundAmount: pct !== null && price
                ? "NT$" + Math.round(price * pct / 100).toLocaleString("en-US") : null,
            refundStartSeq: perCourse(params.refundStartSeq),
            rescheduleMax: params.rescheduleMax,
            transferDays: params.transferDays,
            priceLabel: params.price && course in params.price
                ? "NT $" + Number(params.price[course]).toLocaleString("en-US") : null
        };
        
        document.querySelectorAll("[data-term]").forEach((node) => {

            const v = values[node.getAttribute("data-term")];

            if (v !== null && v !== undefined && String(v) !== "NaN" && String(v) !== "") {
                node.textContent = String(v);
            }

        });

    }


    function renderSessionInfo(all, params) {

        const course = sessionCourseCode();

        const { picked, total } = pickSession(all, course);

        applyTerms(all, params, course, picked);

        if (picked) {

            const count =
                picked.schedule ? picked.schedule.length : 0;

            setInfoField(
                "date",
                slashDate(picked.date) +
                (count > 1 ? "（共 " + count + " 堂）" : "")
            );

            setInfoField(
                "seats",
                picked.status === "waitlist"
                    ? "正取已額滿，候補剩 " + picked.waitLeft + " 人"
                    : "剩餘名額：" + picked.mainLeft + " 人"
            );

            setInfoField("deadline", picked.deadlineText);

        } else {

            setInfoField("date", SESSION_TEXT.noneDate);
            setInfoField("seats", SESSION_TEXT.noneSeats);
            setInfoField("deadline", SESSION_TEXT.noneDeadline);

        }

        updateCtaButtons(picked, course);

        return total;

    }


    // 學員評價：只顯示你在 Sheet「評價」分頁標為「上架」且有「顯示內容」的評價；沒有任何一則就整區隱藏
    // 卡片：姓名（左）＋星等（右）＋內容；內容放不下時出現「查看更多」，點開浮動視窗看全文
    // 輪播：原生橫向捲動（手機可滑動）＋左右箭頭；每次顯示幾張由 LP.css 依視窗寬度決定
    const reviewUi = { modal: null, opener: null, bound: false };

    function reviewStars_(n) {
        const k = Math.round(Number(n));
        return k >= 1 && k <= 5 ? "★".repeat(k) : "";
    }

    function buildReviewHead_(it) {

        const head = document.createElement("div");
        head.className = "lp-evaluate-head";

        const name = document.createElement("p");
        name.className = "lp-evaluate-name";
        name.textContent = it.name || "匿名學員";
        head.appendChild(name);

        const stars = reviewStars_(it.stars);

        if (stars) {
            const st = document.createElement("p");
            st.className = "lp-evaluate-stars";
            st.setAttribute("role", "img");
            st.setAttribute("aria-label", "滿意度 " + Math.round(Number(it.stars)) + " 顆星（滿分 5 顆星）");
            st.textContent = stars;
            head.appendChild(st);
        }

        return head;

    }

    function ensureReviewModal_() {

        if (reviewUi.modal) {
            return reviewUi.modal;
        }

        const wrap = document.createElement("div");
        wrap.className = "lp-evaluate-modal";
        wrap.hidden = true;
        wrap.innerHTML =
            '<div class="lp-evaluate-modal-panel" role="dialog" aria-modal="true" aria-label="完整評價">' +
            '<button class="lp-evaluate-modal-close" type="button" aria-label="關閉">' +
            '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
            '</button>' +
            '<div class="lp-evaluate-modal-content"></div>' +
            '</div>';

        document.body.appendChild(wrap);

        wrap.addEventListener("click", (ev) => {
            if (ev.target === wrap) {
                closeReviewModal_();
            }
        });

        wrap.querySelector(".lp-evaluate-modal-close").addEventListener("click", closeReviewModal_);

        document.addEventListener("keydown", (ev) => {

            if (wrap.hidden) {
                return;
            }

            if (ev.key === "Escape") {
                closeReviewModal_();
            } else if (ev.key === "Tab") {
                ev.preventDefault();
                wrap.querySelector(".lp-evaluate-modal-close").focus();
            }

        });

        reviewUi.modal = wrap;
        return wrap;

    }

    function openReviewModal_(it, opener) {

        const wrap = ensureReviewModal_();
        const box = wrap.querySelector(".lp-evaluate-modal-content");

        box.textContent = "";
        box.appendChild(buildReviewHead_(it));

        if (it.date) {
            const d = document.createElement("p");
            d.className = "lp-evaluate-date";
            d.textContent = it.date;
            box.appendChild(d);
        }

        const t = document.createElement("p");
        t.className = "lp-evaluate-modal-text";
        t.textContent = it.content;
        box.appendChild(t);

        reviewUi.opener = opener || null;
        wrap.hidden = false;
        document.documentElement.classList.add("lp-evaluate-lock");
        wrap.querySelector(".lp-evaluate-modal-close").focus();

    }

    function closeReviewModal_() {

        const wrap = reviewUi.modal;

        if (!wrap || wrap.hidden) {
            return;
        }

        wrap.hidden = true;
        document.documentElement.classList.remove("lp-evaluate-lock");

        if (reviewUi.opener && reviewUi.opener.focus) {
            reviewUi.opener.focus();
        }

        reviewUi.opener = null;

    }

    // 依卡片內容區的高度，算出能放幾行；放不下就截斷並顯示「查看更多」
    function fitReviewCards_() {

        document.querySelectorAll("#lp-evaluate-list .lp-evaluate-card").forEach((card) => {

            const body = card.querySelector(".lp-evaluate-body");
            const text = card.querySelector(".lp-evaluate-text");
            const more = card.querySelector(".lp-evaluate-more");

            if (!body || !text || !more) {
                return;
            }

            text.classList.remove("is-clamped");
            text.style.webkitLineClamp = "";

            const lh = parseFloat(getComputedStyle(text).lineHeight) || 24;
            const lines = Math.max(1, Math.floor(body.clientHeight / lh));
            const cut = text.scrollHeight > lines * lh + 1;

            if (cut) {
                text.style.webkitLineClamp = String(lines);
                text.classList.add("is-clamped");
            }

            more.hidden = !cut;

        });

    }

    function updateReviewArrows_() {

        const list = document.getElementById("lp-evaluate-list");
        const prev = document.getElementById("lp-evaluate-prev");
        const next = document.getElementById("lp-evaluate-next");

        if (!list || !prev || !next) {
            return;
        }

        const max = list.scrollWidth - list.clientWidth;
        const scrollable = max > 4;

        prev.hidden = !scrollable;
        next.hidden = !scrollable;
        prev.disabled = list.scrollLeft <= 2;
        next.disabled = list.scrollLeft >= max - 2;

    }

    function scrollReviews_(dir) {

        const list = document.getElementById("lp-evaluate-list");
        const first = list && list.querySelector(".lp-evaluate-item");

        if (!first) {
            return;
        }

        const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
        const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        list.scrollBy({
            left: dir * (first.getBoundingClientRect().width + gap),
            behavior: reduce ? "auto" : "smooth"
        });

    }

    function bindReviewUi_() {

        if (reviewUi.bound) {
            return;
        }

        const list = document.getElementById("lp-evaluate-list");
        const prev = document.getElementById("lp-evaluate-prev");
        const next = document.getElementById("lp-evaluate-next");

        if (!list || !prev || !next) {
            return;
        }

        reviewUi.bound = true;

        prev.addEventListener("click", () => scrollReviews_(-1));
        next.addEventListener("click", () => scrollReviews_(1));

        let ticking = false;

        list.addEventListener("scroll", () => {
            if (ticking) {
                return;
            }
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                updateReviewArrows_();
            });
        }, { passive: true });

        list.addEventListener("keydown", (ev) => {
            if (ev.key === "ArrowLeft") {
                ev.preventDefault();
                scrollReviews_(-1);
            } else if (ev.key === "ArrowRight") {
                ev.preventDefault();
                scrollReviews_(1);
            }
        });

        const refresh = () => {
            fitReviewCards_();
            updateReviewArrows_();
        };

        if (window.ResizeObserver) {
            new ResizeObserver(refresh).observe(list);
        } else {
            window.addEventListener("resize", refresh);
        }

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(refresh);
        }

    }

    function renderReviews(reviews) {

        const sec = document.getElementById("lp-evaluate");
        const list = document.getElementById("lp-evaluate-list");

        if (!sec || !list) {
            return;
        }

        const items = ((reviews && reviews[sessionCourseCode()]) || []).filter((it) => {
            return it && typeof it.content === "string" && it.content.trim();
        });

        list.textContent = "";

        if (!items.length) {
            sec.hidden = true;
            return;
        }

        items.forEach((it) => {

            const li = document.createElement("li");
            li.className = "lp-evaluate-item";

            const card = document.createElement("article");
            card.className = "lp-evaluate-card";

            card.appendChild(buildReviewHead_(it));

            const body = document.createElement("div");
            body.className = "lp-evaluate-body";

            const text = document.createElement("p");
            text.className = "lp-evaluate-text";
            text.textContent = it.content;
            body.appendChild(text);
            card.appendChild(body);

            const foot = document.createElement("div");
            foot.className = "lp-evaluate-foot";

            const date = document.createElement("span");
            date.className = "lp-evaluate-date";
            date.textContent = it.date || "";
            foot.appendChild(date);

            const more = document.createElement("button");
            more.type = "button";
            more.className = "lp-evaluate-more";
            more.hidden = true;
            more.setAttribute("aria-haspopup", "dialog");
            more.innerHTML = '查看更多<span class="lp-evaluate-chev" aria-hidden="true"></span>';
            more.addEventListener("click", () => openReviewModal_(it, more));
            foot.appendChild(more);

            card.appendChild(foot);
            li.appendChild(card);
            list.appendChild(li);

        });

        sec.hidden = false;
        list.scrollLeft = 0;

        bindReviewUi_();
        fitReviewCards_();
        updateReviewArrows_();

    }

    async function initSessionInfo() {

        // 頁面沒有 info card 欄位、也沒有報名按鈕，就不用做事
        if (
            !document.querySelector("[data-session-field]") &&
            !document.querySelector(".lp-cta-link")
        ) {
            return;
        }

        const cached = readSessionCache();

        if (cached) {

            renderSessionInfo(cached.sessions, cached.params);
            renderReviews(cached.reviews);

        } else {

            setInfoField("date", SESSION_TEXT.loading);
            setInfoField("seats", SESSION_TEXT.loading);
            setInfoField("deadline", SESSION_TEXT.loading);

        }

        try {

            const fresh = await fetchSessions();

            writeSessionCache(fresh);

            renderSessionInfo(fresh.sessions, fresh.params);
            renderReviews(fresh.reviews);

        } catch (err) {

            console.warn("[LP.js] 梯次資料載入失敗：", err);

            if (!cached) {

                setInfoField("date", SESSION_TEXT.failOther);
                setInfoField("seats", SESSION_TEXT.failSeats);
                setInfoField("deadline", SESSION_TEXT.failOther);

                // 按鈕維持原本「立即報名」，報名頁自己會處理連線問題

            }

        }

    }

    /* =====================================================
       03. ACCORDION

       共用於：
       - Lesson 區（LP1 / LP2 單層，LP3 雙層巢狀）
       - FAQ 兩欄

       行為：
       - 點擊 trigger 切換 aria-expanded / is-open
       - 用 max-height 做展開收合動畫（而非直接顯示/隱藏），
         這樣巢狀 accordion 展開時，
         外層 panel 的高度也能一起撐開。
       - 同一組 data-accordion="xxx-0" 底下，
         點開一個項目不會自動收合其他項目
         （Lesson / FAQ 都需要可以同時展開多題）。
       ===================================================== */

    function measureOpenHeight(panel) {

        return panel.scrollHeight;

    }


    function setAccordionState(trigger, panel, item, isOpen) {

        trigger.setAttribute(
            "aria-expanded",
            isOpen ? "true" : "false"
        );


        if (item) {

            item.classList.toggle(
                "is-open",
                isOpen
            );

        }


        if (isOpen) {

            panel.style.maxHeight =
                measureOpenHeight(panel) + "px";

        } else {

            panel.style.maxHeight = "0px";

        }

    }


    /*
        巢狀 accordion 展開/收合時，
        外層所有「目前是開啟狀態」的 panel
        高度都要跟著重新量測，
        不然外層的 max-height 會停留在舊的數字，
        把新展開的內容截掉。
    */

    function refreshOpenAncestors(panel) {

        let current =
            panel.parentElement &&
            panel.parentElement.closest(
                ".lp-accordion-panel"
            );


        while (current) {

            if (current.style.maxHeight !== "0px" &&
                current.style.maxHeight !== "") {

                current.style.maxHeight =
                    measureOpenHeight(current) + "px";

            }


            current =
                current.parentElement &&
                current.parentElement.closest(
                    ".lp-accordion-panel"
                );

        }

    }


    function initAccordionTrigger(trigger) {

        const panelId =
            trigger.getAttribute(
                "aria-controls"
            );


        const panel =
            panelId &&
            document.getElementById(panelId);


        if (!panel) {

            return;

        }


        const item =
            trigger.closest(
                "[data-accordion-item]"
            );


        /*
            接管顯示邏輯：
            不再依賴 [hidden]，改用 max-height，
            [hidden] 只作為「沒有 JS 時」的保底顯示狀態。
        */

        panel.removeAttribute("hidden");

        panel.style.overflow = "hidden";

        panel.style.transition =
            "max-height .45s " +
            (
                state.prefersReducedMotion
                    ? "linear"
                    : "cubic-bezier(.4,0,.2,1)"
            );


        const startsOpen =
            trigger.getAttribute("aria-expanded") === "true";

        panel.style.maxHeight =
            startsOpen
                ? measureOpenHeight(panel) + "px"
                : "0px";


        trigger.addEventListener(
            "click",
            () => {

                const isOpen =
                    trigger.getAttribute("aria-expanded") === "true";

                setAccordionState(
                    trigger,
                    panel,
                    item,
                    !isOpen
                );

                refreshOpenAncestors(panel);


                /*
                    Lesson 手風琴展開/收合會改變左側欄位高度，
                    通知 initLessonSticky() 重新量測——
                    立即發一次（抓開始變化的當下），
                    panel 的 max-height transition 結束後
                    再發一次（抓最終定案的高度）。
                */

                window.dispatchEvent(
                    new Event("lp:layout-changed")
                );

                panel.addEventListener(
                    "transitionend",
                    () => {

                        window.dispatchEvent(
                            new Event("lp:layout-changed")
                        );

                    },
                    {
                        once: true
                    }
                );

            }
        );

    }


    function initAccordions() {

        const triggers =
            document.querySelectorAll(
                "[data-accordion-trigger]"
            );


        if (!triggers.length) {

            return;

        }


        triggers.forEach(initAccordionTrigger);


        /*
            圖片載入完成後，
            Lesson 區 sticky 圖片旁的 accordion
            高度可能因為圖片高度而跟著變動，
            這裡統一重新量一次目前展開項目的高度。
        */

        window.addEventListener(
            "load",
            () => {

                triggers.forEach(
                    (trigger) => {

                        if (trigger.getAttribute("aria-expanded") !== "true") {

                            return;

                        }


                        const panelId =
                            trigger.getAttribute("aria-controls");

                        const panel =
                            panelId &&
                            document.getElementById(panelId);


                        if (panel) {

                            panel.style.maxHeight =
                                measureOpenHeight(panel) + "px";

                        }

                    }
                );

            }
        );

    }



    /* =====================================================
       04. HOW SECTION 圖片淡入淡出

       image-1 固定不動當底圖，image-2（可能是透明背景 PNG）
       跟 image-1 同比例、同位置疊在上面。
       時間軸（每 3 秒切一次，形成 6 秒一個循環）：
         0s → 只有 image-1
         3s → image-2 淡入疊上去
         6s → image-2 淡出，只剩 image-1
         9s → image-2 再次淡入...（循環）
       ===================================================== */

    function initHowFade() {

        const wraps =
            document.querySelectorAll(
                '[data-carousel="how"]'
            );


        if (!wraps.length) {

            return;

        }


        /*
            這個效果不受「減少動態效果」設定影響，
            不管使用者系統/瀏覽器有沒有開啟，都固定播放——
            因為圖片本身帶有需要傳達的資訊，不是單純裝飾性動態。
        */


        wraps.forEach(
            (wrap) => {

                const overlay =
                    wrap.querySelector(
                        ".lp-how-image-2"
                    );


                if (!overlay) {

                    return;

                }


                let isVisible = false;


                setInterval(
                    () => {

                        isVisible = !isVisible;

                        overlay.classList.toggle(
                            "is-active",
                            isVisible
                        );

                    },
                    3000
                );

            }
        );

    }



    /* =====================================================
       05. ABILITY MOBILE DOTS

       比照 script.js 的 initCaseStudyDots()，
       只是項目數量不是固定 3 個，
       改成動態抓 .lp-ability-item 的數量。

       V10 改動：
       每張卡片自己的 image 和 subtitle 之間都放一組
       [data-carousel-dots]（同樣 4 個 dot），不再只有卡片組
       捲動完之後才出現的單一組 dots——這樣不管使用者停在
       哪一張卡片，都能在第一眼看到「可以左右滑」的提示。
       所有組別的 active 狀態永遠同步（代表同一個
       activeIndex），點擊任一組的任一個 dot 都能捲動整個
       scroller。
       ===================================================== */

    function initAbilityDots() {

        const scroller =
            document.querySelector(
                ".lp-ability-scroller"
            );


        const items =
            document.querySelectorAll(
                ".lp-ability-item"
            );


        const dotGroups =
            document.querySelectorAll(
                "[data-carousel-dots]"
            );


        if (!scroller ||
            !items.length ||
            !dotGroups.length) {

            return;

        }


        const groupsMatchItemCount =
            Array.from(dotGroups).every(
                (group) => {

                    return (
                        group.querySelectorAll(
                            ".lp-ability-dot"
                        ).length === items.length
                    );

                }
            );


        if (!groupsMatchItemCount) {

            return;

        }


        function updateActiveDot() {

            const scrollerRect =
                scroller.getBoundingClientRect();


            const viewportCenter =
                scrollerRect.left +
                scrollerRect.width / 2;


            let activeIndex = 0;

            let closestDistance = Infinity;


            items.forEach(
                (item, index) => {

                    const itemRect =
                        item.getBoundingClientRect();


                    const itemCenter =
                        itemRect.left +
                        itemRect.width / 2;


                    const distance =
                        Math.abs(
                            itemCenter - viewportCenter
                        );


                    if (distance < closestDistance) {

                        closestDistance = distance;

                        activeIndex = index;

                    }

                }
            );


            dotGroups.forEach(
                (group) => {

                    const dots =
                        group.querySelectorAll(
                            ".lp-ability-dot"
                        );

                    dots.forEach(
                        (dot, index) => {

                            dot.classList.toggle(
                                "is-active",
                                index === activeIndex
                            );

                        }
                    );

                }
            );

        }


        function scrollToIndex(index) {

            const item = items[index];

            if (!item) {

                return;

            }


            const scrollerRect =
                scroller.getBoundingClientRect();

            const itemRect =
                item.getBoundingClientRect();

            const currentScroll =
                scroller.scrollLeft;

            const itemCenter =
                itemRect.left +
                itemRect.width / 2;

            const viewportCenter =
                scrollerRect.left +
                scrollerRect.width / 2;

            const targetScroll =
                currentScroll +
                (itemCenter - viewportCenter);


            scroller.scrollTo({

                left: targetScroll,

                behavior:
                    state.prefersReducedMotion
                        ? "auto"
                        : "smooth"

            });

        }


        scroller.addEventListener(
            "scroll",
            updateActiveDot,
            {
                passive: true
            }
        );


        dotGroups.forEach(
            (group) => {

                const dots =
                    group.querySelectorAll(
                        ".lp-ability-dot"
                    );

                dots.forEach(
                    (dot, index) => {

                        dot.addEventListener(
                            "click",
                            () => {

                                scrollToIndex(index);

                            }
                        );

                    }
                );

            }
        );


        updateActiveDot();


        window.addEventListener(
            "resize",
            updateActiveDot
        );

    }



    /* =====================================================
       06. SCROLL REVEAL

       通用版的滾動淡入，跟首頁 initSectionReveal() 是同一套
       視覺語言，但獨立實作（首頁那套的時間軸是寫死給
       Learning Path 特定區塊用的，沒辦法直接共用）。

       規則：
       - 「trigger」進入視窗時，幫「targets」都加上
         .jg-reveal-visible，加過一次就 unobserve（不會重複觸發）
       - Ability 卡片用 index 做輕微的 stagger（一個接一個淡入）
       - Info Card 的延遲效果已經寫在 CSS transition-delay 裡，
         這裡只要負責「進場就加 class」就好
       ===================================================== */

    function initScrollReveal() {

        if (state.prefersReducedMotion) {

            /*
                減少動態效果時，
                CSS 那邊的 @media (prefers-reduced-motion: reduce)
                已經把所有 reveal 元素強制設成可見狀態，
                這裡就不用另外跑 observer 了。
            */

            return;

        }


        if (!("IntersectionObserver" in window)) {

            /*
                瀏覽器不支援 IntersectionObserver 時，
                直接把所有 reveal 元素显示出來，
                不要讓內容永遠卡在 opacity:0。
            */

            document.querySelectorAll(
                ".lp-reveal-text, .lp-reveal-image, .lp-info-card"
            ).forEach(
                (el) => {

                    el.classList.add(
                        "jg-reveal-visible"
                    );

                }
            );

            return;

        }


        function addStagger(targets, stepMs) {

            targets.forEach(
                (target, index) => {

                    target.style.setProperty(
                        "--lp-reveal-delay",
                        (index * stepMs) + "ms"
                    );

                }
            );

        }


        /*
            幫既有的 lp- 元素動態掛上 .lp-reveal-text /
            .lp-reveal-image，不用另外改 HTML。
        */

        document.querySelectorAll(
            ".lp-pain-title, .lp-pain-content, " +
            ".lp-how-copy, " +
            ".lp-ability-title, " +
            ".lp-lesson-title, " +
            ".lp-faq-heading, " +
            ".lp-final-cta-title, .lp-final-cta-content, .lp-final-cta-link"
        ).forEach(
            (el) => {

                el.classList.add(
                    "lp-reveal-text"
                );

            }
        );


        document.querySelectorAll(
            ".lp-how-media, .lp-lesson-media"
        ).forEach(
            (el) => {

                el.classList.add(
                    "lp-reveal-image"
                );

            }
        );


        const abilityItems =
            document.querySelectorAll(
                ".lp-ability-item"
            );

        abilityItems.forEach(
            (el) => {

                el.classList.add(
                    "lp-reveal-text"
                );

            }
        );

        addStagger(abilityItems, 90);


        /*
            trigger 進入視窗 → target(s) 一起淡入。
            trigger 跟 target 相同時，就是「自己進場、自己淡入」。
        */

        const groups = [

            {
                trigger: document.querySelector(".lp-pain-inner"),
                targets: document.querySelectorAll(".lp-pain-title, .lp-pain-content")
            },

            {
                trigger: document.querySelector(".lp-how-inner"),
                targets: document.querySelectorAll(".lp-how-media, .lp-how-copy")
            },

            {
                trigger: document.querySelector(".lp-ability-inner"),
                targets: document.querySelectorAll(".lp-ability-title, .lp-ability-item")
            },

            {
                trigger: document.querySelector(".lp-lesson"),
                targets: document.querySelectorAll(".lp-lesson-title, .lp-lesson-media")
            },

            {
                trigger: document.querySelector(".lp-info"),
                targets: document.querySelectorAll(".lp-info-card")
            },

            {
                trigger: document.querySelector(".lp-faq-inner"),
                targets: document.querySelectorAll(".lp-faq-heading")
            },

            {
                trigger: document.querySelector(".lp-final-cta-inner"),
                targets: document.querySelectorAll(
                    ".lp-final-cta-title, .lp-final-cta-content, .lp-final-cta-link"
                )
            }

        ].filter(
            (group) => {

                return (
                    group.trigger &&
                    group.targets.length
                );

            }
        );


        function revealEntries(entries, observer) {

            entries.forEach(
                (entry) => {

                    if (!entry.isIntersecting) {

                        return;

                    }


                    const group =
                        groups.find(
                            (item) => item.trigger === entry.target
                        );


                    if (!group) {

                        return;

                    }


                    group.targets.forEach(
                        (target) => {

                            target.classList.add(
                                "jg-reveal-visible"
                            );

                        }
                    );


                    observer.unobserve(
                        entry.target
                    );

                }
            );

        }


        const observer =
            new IntersectionObserver(
                revealEntries,
                {
                    threshold: 0.1,
                    rootMargin: "0px 0px -10% 0px"
                }
            );


        groups.forEach(
            (group) => {

                observer.observe(
                    group.trigger
                );

            }
        );

    }



    /* =====================================================
       07. LESSON 圖片「跟隨捲動、碰底就停」效果
       （Desktop / Tablet only，仿 lindsayadlerphotography.com
       What's Included 區塊的效果）

       原理：
       - .lp-lesson-media 是 position:relative 的高欄位
         （靠 .lp-lesson-inner 的 align-items:stretch 撐到
         跟左側手風琴一樣高）
       - .lp-lesson-image 是裡面 position:absolute 的圖片，
         用 JS 直接控制它的 top 值：
           想要的「跟隨視窗」位置 = 距離視窗頂端 stickyOffset px
           換算成「相對 wrapper 頂端」的 top 值後，
           夾在 [0, wrapper高度 - 圖片高度] 之間
       - 這樣圖片會一路跟著捲動移動，直到圖片底部
         抵達 wrapper（也就是左側文字欄）底部，才會停止，
         不會用到 CSS position:sticky——因為手風琴用 JS
         動態改變左側高度時，sticky 在部分瀏覽器上
         沒有即時重新計算，才會出現對不準、留白的狀況。
         這裡改成「每個 scroll frame 都重新即時量測」，
         永遠是當下最新的真實高度，不會有這個問題。
       - accordion 展開/收合時會另外觸發
         "lp:layout-changed" 事件，讓這裡立刻重算一次，
         不用等使用者捲動才更新。
       - Mobile（<768px）：top 直接清空，回到 CSS 裡
         position:static 的一般文檔流。
       ===================================================== */

    function initLessonSticky() {

        const wrappers =
            document.querySelectorAll(
                ".lp-lesson-media"
            );


        if (!wrappers.length) {

            return;

        }


        /*
            這個效果不受「減少動態效果」設定影響，
            不管使用者系統/瀏覽器有沒有開啟，都固定執行——
            圖片內容需要跟著捲動被完整看到。
        */


        const headerHeightRaw =
            getComputedStyle(
                document.documentElement
            ).getPropertyValue("--header-height");

        const stickyOffset =
            (parseFloat(headerHeightRaw) || 72) + 24;


        let ticking = false;


        function update() {

            const isActive =
                window.innerWidth >= 768;


            wrappers.forEach(
                (wrapper) => {

                    const image =
                        wrapper.querySelector(
                            ".lp-lesson-image"
                        );


                    if (!image) {

                        return;

                    }


                    if (!isActive) {

                        image.style.top = "";

                        wrapper.style.minHeight = "";

                        return;

                    }


                    /*
                        手風琴全部收合時，左側欄位（跟著它一起
                        align-items:stretch 的 wrapper）會變矮，
                        矮欄位裝不下圖片本身的高度，圖片會往下
                        溢出、蓋到下一個 section（Info Card）。
                        用 JS 把 wrapper 的 min-height 頂到
                        至少跟圖片一樣高，從根本避免這個溢出——
                        CSS 那邊的 overflow:hidden 只是預防
                        這行 JS 還沒跑到那一刻的畫面閃爍，
                        不是真正的修正。
                    */

                    wrapper.style.minHeight =
                        image.offsetHeight + "px";


                    const wrapperRect =
                        wrapper.getBoundingClientRect();

                    const imageHeight =
                        image.offsetHeight;


                    let desiredTop =
                        stickyOffset - wrapperRect.top;


                    const maxTop =
                        Math.max(
                            wrapperRect.height - imageHeight,
                            0
                        );


                    desiredTop =
                        Math.min(
                            Math.max(desiredTop, 0),
                            maxTop
                        );


                    image.style.top =
                        desiredTop + "px";

                }
            );


            ticking = false;

        }


        function onScroll() {

            if (!ticking) {

                requestAnimationFrame(update);

                ticking = true;

            }

        }


        window.addEventListener(
            "scroll",
            onScroll,
            {
                passive: true
            }
        );


        window.addEventListener(
            "resize",
            onScroll
        );


        window.addEventListener(
            "lp:layout-changed",
            onScroll
        );


        update();

    }



    /* =====================================================
       08. INFO CARD 持續視差

       跟 06 的「進場淡入」是分開的兩件事：
       進場只管 opacity（CSS 的 .jg-reveal-visible），
       這裡管「進場之後、捲動過程中」背景與卡片的
       上下位移——兩者速度、方向都不同，
       製造出錯位移動的視差感。
       transform 完全由這裡的 inline style 控制，
       所以 CSS 那邊 .lp-info-card 不能再放 transform，
       不然兩邊會互相蓋掉、打架。
       ===================================================== */

    function initInfoParallax() {

        const sections =
            document.querySelectorAll(
                ".lp-info"
            );


        if (!sections.length) {

            return;

        }


        if (state.prefersReducedMotion) {

            return;

        }


        const BG_RATE = -140;   // 背景：位移範圍較小，方向較慢
        const CARD_RATE = 170;  // 卡片：位移範圍較大、方向跟背景相反

        let ticking = false;


        function update() {

            sections.forEach(
                (section) => {

                    const bg =
                        section.querySelector(".lp-info-bg");

                    const card =
                        section.querySelector(".lp-info-card");


                    if (!bg || !card) {

                        return;

                    }


                    const rect =
                        section.getBoundingClientRect();

                    const viewportHeight =
                        window.innerHeight;


                    /*
                        progress：-1 = 區塊剛進入視窗下緣，
                        0 = 區塊中心對齊視窗中心，
                        +1 = 區塊剛離開視窗上緣。
                        用「有號」的進度，滾動方向改變時
                        位移方向也會自然跟著反過來。
                    */

                    const sectionCenter =
                        rect.top + rect.height / 2;

                    const viewportCenter =
                        viewportHeight / 2;

                    const range =
                        (rect.height + viewportHeight) / 2;

                    let progress =
                        (sectionCenter - viewportCenter) / range;

                    progress =
                        Math.min(
                            Math.max(progress, -1),
                            1
                        );


                    const bgShift =
                        progress * BG_RATE;

                    const cardShift =
                        progress * CARD_RATE;


                    bg.style.transform =
                        "translate3d(0, " + bgShift + "px, 0)";

                    card.style.transform =
                        "translate3d(0, " + cardShift + "px, 0)";

                }
            );


            ticking = false;

        }


        function onScroll() {

            if (!ticking) {

                requestAnimationFrame(update);

                ticking = true;

            }

        }


        window.addEventListener(
            "scroll",
            onScroll,
            {
                passive: true
            }
        );


        window.addEventListener(
            "resize",
            onScroll
        );


        update();

    }



    /* =====================================================
       09. INITIALIZATION
       ===================================================== */

    initCtaLinks();

    initSessionInfo();

    initAccordions();

    initHowFade();

    initAbilityDots();

    initScrollReveal();

    initLessonSticky();

    initInfoParallax();


});
