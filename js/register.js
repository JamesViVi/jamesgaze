/* =========================================================
   James Gaze
   register.js — 報名頁（第二版）

   流程
   ---------------------------------------------------------
   01. 設定
   02. 工具
   03. 讀取梯次（逾時＋重試一次）
   04. 畫面：梯次選項與每堂日程
   05. 驗證
   06. 送出
   07. 成功畫面
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       01. 設定（只需要改這裡）
       ===================================================== */

    const API_URL =
        "https://script.google.com/macros/s/AKfycbwC-LG0gskNwglEwla2FloU5rr2MiMkKCq9srZz92iKzOHgFOsVSNzVvh8DANPHbwbxMw/exec";

    // 必須和 Sheet「設定」分頁的「契約版本」一模一樣
    const CONTRACT_VERSION = "v0-草稿";

    const GET_TIMEOUT_MS = 20000;
    const POST_TIMEOUT_MS = 45000;
    const SENDER_EMAIL = "jamesgaze.tw@gmail.com";

    const LP_PAGES = {
        LP1: "LP1.html",
        LP2: "LP2.html",
        LP3: "LP3.html"
    };

    // 契約與說明文字裡的數字（名額、截止天數、退費金額）一律由 API 回傳，
    // 來源是 Sheet 的「梯次」與「設定」分頁，這裡不寫死。
    // HTML 裡寫成 <span data-term="mainCap">6</span>，括號內的字只是讀取失敗時的備用。

    const MSG_GENERIC_ERROR =
        "系統暫時無法處理，請以 IG 或 email 私訊報名，我會手動為您登記。";

    const MSG_UNCERTAIN =
        "無法確認是否已送出成功。請直接再按一次「送出報名」，" +
        "系統會顯示您先前的報名資料，不會重複報名；" +
        "也可以先檢查信箱是否已收到確認信。";


    /* =====================================================
       02. 工具
       ===================================================== */

    const $ = (id) => document.getElementById(id);

    const form = $("reg-form");
    const loadingEl = $("reg-loading");
    const fallbackEl = $("reg-fallback");
    const listEl = $("session-list");
    const submitBtn = $("submit-btn");
    const formErrorEl = $("form-error");
    const resultEl = $("reg-result");

    let sessions = [];
    let siteParams = null;
    let submitting = false;


    function el(tag, className, text) {

        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (text !== undefined) {
            node.textContent = text;
        }

        return node;

    }


    function fmtDate(iso) {

        return String(iso).replace(/-/g, "/");

    }


    function fmtMoney(n) {

        return "NT$" + Number(n).toLocaleString("en-US");

    }


    // 2026-11-14 → 六
    function weekday(iso) {

        const p = String(iso).split("-");

        const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));

        return "日一二三四五六".charAt(d.getDay());

    }


    // 每一堂拆成「資訊區塊」：日期、時間（上午／下午各一塊）、地點。
    // 桌機同一行排列；手機每個區塊各占一行，不會從資訊中間斷行。
    function scheduleItem(x, i) {

        const li = document.createElement("li");

        li.appendChild(
            el(
                "span",
                "reg-chunk reg-sch-head",
                "第 " + (i + 1) + " 堂　" +
                fmtDate(x.date) + "（週" + weekday(x.date) + "）"
            )
        );

        if (x.time) {

            x.time.split("、").forEach((part) => {

                const t = part.trim();

                if (t) {
                    li.appendChild(el("span", "reg-chunk reg-sch-time", t));
                }

            });

        }

        if (x.venue) {
            li.appendChild(el("span", "reg-chunk reg-sch-venue", x.venue));
        }

        return li;

    }


    function scheduleList(list) {

        const ul = el("ul", "reg-schedule-list");

        list.forEach((x, i) => {
            ul.appendChild(scheduleItem(x, i));
        });

        return ul;

    }


    async function timeoutFetch(url, options, ms) {

        const ctrl = new AbortController();

        const timer = setTimeout(() => ctrl.abort(), ms);

        try {

            return await fetch(
                url,
                Object.assign({}, options, { signal: ctrl.signal })
            );

        } finally {

            clearTimeout(timer);

        }

    }


    const params = new URLSearchParams(window.location.search);

    const courseFilter = (params.get("course") || "").toUpperCase();

    const presetSession = params.get("session") || "";


    // 返回課程頁連結
    if (LP_PAGES[courseFilter]) {

        $("reg-back").setAttribute("href", LP_PAGES[courseFilter]);

    }


    /* =====================================================
       03. 讀取梯次
       ===================================================== */

    async function loadSessions() {

        let lastErr;

        for (let i = 0; i < 2; i++) {

            try {

                const res = await timeoutFetch(
                    API_URL + "?action=sessions",
                    {},
                    GET_TIMEOUT_MS
                );

                if (!res.ok) {
                    throw new Error("HTTP " + res.status);
                }

                const data = await res.json();

                if (!data.ok) {
                    throw new Error("API 回傳失敗");
                }

                siteParams = data.params || null;

                return data.sessions;

            } catch (err) {

                lastErr = err;

                console.warn("[register] 第 " + (i + 1) + " 次讀取失敗：", err);

            }

        }

        throw lastErr;

    }


    /* =====================================================
       03b. 契約與說明文字的數字（來自 API）
       ===================================================== */

    // 0 元寫成「0 元」，其餘寫成「NT$12,000」
    function fmtRefund(n) {

        const v = Number(n) || 0;

        return v === 0 ? "0 元" : fmtMoney(v);

    }


    // 沒選梯次時，名額以列表第一個梯次為準
    function termSession() {

        return selectedSession() || sessions[0] || null;

    }


    function termValue(key) {

        const p = siteParams;
        const parts = key.split(":");
        const name = parts[0];
        const course = parts[1];
        const s = termSession();

        switch (name) {

            case "mainCap":
                return s ? String(s.mainCap) : null;

            case "waitCap":
                return s ? String(s.waitCap) : null;

            case "minPeople":
                if (!p) { return null; }
                if (p.minPeople && typeof p.minPeople === "object") {
                    return course in p.minPeople ? String(p.minPeople[course]) : null;
                }
                return p.minPeople ? String(p.minPeople) : null;

            case "refundPct":
                return p && p.refundPct && course in p.refundPct
                    ? p.refundPct[course] + "%" : null;

            case "refundStartSeq":
                return p && p.refundStartSeq && course in p.refundStartSeq
                    ? String(p.refundStartSeq[course]) : null;

            case "rescheduleMax":
                return p && p.rescheduleMax ? String(p.rescheduleMax) : null;

            case "abandonDays":
                return p && p.abandonDays ? String(p.abandonDays) : null;

            case "transferDays":
                return p && p.transferDays ? String(p.transferDays) : null;

            case "replyDays":
                return p && p.replyDays ? String(p.replyDays) : null;

            case "deadlineDayN":
                return p && p.deadlineDays ? String(Number(p.deadlineDays) + 1) : null;

            case "deadlineDays":
                return p ? String(p.deadlineDays) : null;

            case "refundDays":
                return p ? String(p.refundDays) : null;

            case "refundAfter":
                return p && p.refundAfter && course in p.refundAfter
                    ? fmtRefund(p.refundAfter[course]) : null;

            case "price":
                return p && p.price && course in p.price
                    ? fmtMoney(p.price[course]) : null;

            default:
                return null;

        }

    }


    function applyTerms() {

        document.querySelectorAll("[data-term]").forEach((node) => {

            const v = termValue(node.getAttribute("data-term"));

            if (v !== null && v !== "NaN") {
                node.textContent = v;
            }

        });

    }


    /* =====================================================
       04. 畫面：梯次選項與每堂日程
       ===================================================== */

    function statusInfo(s) {

        switch (s.status) {

            case "open":
                return {
                    text: "剩餘正取 " + s.mainLeft + " 席",
                    ok: true
                };

            case "waitlist":
                return {
                    text: "正取已額滿，可登記候補（候補剩 " + s.waitLeft + " 席）",
                    ok: true
                };

            case "full":
                return { text: "本梯已額滿", ok: false };

            case "closed":
                return { text: "報名已截止", ok: false };

            default:
                return { text: "名額確認中", ok: false };

        }

    }


    function renderSessions() {

        listEl.textContent = "";

        sessions.forEach((s) => {

            const info = statusInfo(s);
            const count = s.schedule ? s.schedule.length : 0;

            const wrap = el("div", "reg-session-wrap");

            const label = el("label", "reg-session");

            const input = document.createElement("input");
            input.type = "radio";
            input.name = "session";
            input.value = s.id;
            input.disabled = !info.ok;

            const body = el("span", "reg-session-body");

            const title = el("span", "reg-session-title");

            title.appendChild(
                el("span", "reg-chunk reg-session-name", s.courseName)
            );

            title.appendChild(
                el(
                    "span",
                    "reg-chunk reg-session-when",
                    fmtDate(s.date) + " 開課" +
                    (count > 1 ? "（共 " + count + " 堂）" : "")
                )
            );

            body.appendChild(title);

            const meta = el("span", "reg-session-meta");

            [
                s.venue,
                "報名截止 " + s.deadlineText,
                fmtMoney(s.price)
            ].forEach((text) => {

                if (text) {
                    meta.appendChild(el("span", "reg-chunk", text));
                }

            });

            body.appendChild(meta);

            body.appendChild(
                el("span", "reg-session-seats", info.text)
            );

            label.appendChild(input);
            label.appendChild(body);
            wrap.appendChild(label);

            // 每一堂的日期、時間、地點
            if (count) {

                const det = el("details", "reg-schedule");

                det.appendChild(
                    el(
                        "summary",
                        "",
                        count > 1
                            ? "查看 " + count + " 堂課的日期、時間與地點"
                            : "查看上課時間與地點"
                    )
                );

                det.appendChild(scheduleList(s.schedule));

                wrap.appendChild(det);

            }

            listEl.appendChild(wrap);

        });


        // 預選：網址指定的梯次，或只有一個可選時自動選取
        const selectable = Array.from(
            listEl.querySelectorAll('input[name="session"]:not(:disabled)')
        );

        let pick = null;

        if (presetSession) {
            pick = selectable.find((i) => i.value === presetSession) || null;
        }

        if (!pick && selectable.length === 1) {
            pick = selectable[0];
        }

        if (pick) {
            pick.checked = true;
        }

        onSessionChange();

    }


    function selectedSession() {

        const checked = listEl.querySelector('input[name="session"]:checked');

        if (!checked) {
            return null;
        }

        return sessions.find((s) => s.id === checked.value) || null;

    }


    function onSessionChange() {

        const s = selectedSession();

        const waitNote = $("waitlist-note");
        const lp3Note = $("lp3-note");

        if (s && s.status === "waitlist") {

            const days = siteParams && siteParams.replyDays ? siteParams.replyDays : 7;

            $("waitlist-note-text").textContent =
                "這一梯正取名額已滿，您將登記為候補。候補同樣需要先匯款，" +
                "經我確認入帳後才列入候補名單。候補期間，您可以隨時申請全額退費，或改報下一梯。" +
                "若日後遞補為正取，適用與正取相同的規定。" +
                "開課日仍未遞補者，我會於開課日當天通知，您可選擇全額退費或改報下一梯；" +
                "通知後 " + days + " 日內未選擇者，視為申請全額退費。";

            waitNote.hidden = false;

        } else {

            waitNote.hidden = true;

        }

        lp3Note.hidden = !(s && s.course === "LP3");

        if (s && LP_PAGES[s.course]) {
            $("reg-back").setAttribute("href", LP_PAGES[s.course]);
        }

        clearError("session");

        applyTerms();

    }


    listEl.addEventListener("change", onSessionChange);


    /* =====================================================
       05. 驗證
       ===================================================== */

    function collect() {

        const f = form.elements;

        const digits = (v) => String(v).trim().replace(/[\s-]/g, "");

        const s = selectedSession();

        return {
            sessionId: s ? s.id : "",
            name: f.name.value.trim(),
            email: f.email.value.trim().toLowerCase(),
            phone: digits(f.phone.value),
            line: f.line.value.trim(),
            bankCode: digits(f.bankCode.value),
            account: digits(f.account.value),
            accountName: f.accountName.value.trim(),
            agreed: f.agreed.checked,
            ageOk: f.ageOk.checked,
            portraitOk: f.portraitOk.checked,
            optIn: f.optIn.checked,
            hp_contact: f.hp_contact.value
        };

    }


    function validate(v) {

        const errs = {};

        if (!v.sessionId) {
            errs.session = "請選擇梯次。";
        }

        if (v.name.length < 2) {
            errs.name = "請填寫姓名。";
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) {
            errs.email = "Email 格式不正確。";
        }

        if (!/^09\d{8}$/.test(v.phone)) {
            errs.phone = "請填寫 10 碼手機號碼，例如 0912345678。";
        }

        if (!/^\d{3,7}$/.test(v.bankCode)) {
            errs.bankCode = "銀行代碼請填 3 到 7 位數字。";
        }

        if (!/^\d{6,16}$/.test(v.account)) {
            errs.account = "帳號請填 6 到 16 位數字。";
        }

        if (v.accountName.length < 2) {
            errs.accountName = "請填寫戶名。";
        }

        if (!v.agreed) {
            errs.agreed = "請先勾選同意契約。";
        }

        if (!v.ageOk) {
            errs.ageOk = "請勾選聲明年滿 18 歲。";
        }

        return errs;

    }


    const FIELD_IDS = {
        session: "session-list",
        name: "f-name",
        email: "f-email",
        phone: "f-phone",
        bankCode: "f-bankCode",
        account: "f-account",
        accountName: "f-accountName",
        agreed: "f-agreed",
        ageOk: "f-ageOk"
    };


    function errorNode(key) {

        return form.querySelector('[data-error-for="' + key + '"]');

    }


    function clearError(key) {

        const node = errorNode(key);

        if (node) {
            node.textContent = "";
        }

        const input = $(FIELD_IDS[key]);

        if (input && input.removeAttribute) {
            input.removeAttribute("aria-invalid");
        }

    }


    function showErrors(errs) {

        Object.keys(FIELD_IDS).forEach((key) => {

            clearError(key);

            if (errs[key]) {

                const node = errorNode(key);

                if (node) {
                    node.textContent = errs[key];
                }

                const input = $(FIELD_IDS[key]);

                if (input && key !== "session") {
                    input.setAttribute("aria-invalid", "true");
                }

            }

        });

        const first = Object.keys(FIELD_IDS).find((k) => errs[k]);

        if (first) {

            const target = $(FIELD_IDS[first]);

            if (target) {

                target.scrollIntoView({ behavior: "smooth", block: "center" });

                if (first !== "session") {
                    target.focus({ preventScroll: true });
                }

            }

        }

    }


    // 輸入時清掉該欄錯誤
    Object.keys(FIELD_IDS).forEach((key) => {

        const input = $(FIELD_IDS[key]);

        if (input && key !== "session") {
            input.addEventListener("input", () => clearError(key));
        }

    });


    // 契約勾選 → 送出鈕才能按
    function updateSubmitState() {

        const agreed = $("f-agreed").checked;
        const ageOk = $("f-ageOk").checked;

        submitBtn.disabled = !(agreed && ageOk) || submitting;

        if (agreed) {
            clearError("agreed");
        }

        if (ageOk) {
            clearError("ageOk");
        }

    }

    $("f-agreed").addEventListener("change", updateSubmitState);
    $("f-ageOk").addEventListener("change", updateSubmitState);


    /* =====================================================
       06. 送出
       ===================================================== */

    // 伺服器回傳必須是「報名成功」格式才顯示成功畫面，
    // 其他任何格式都不當作成功，避免出現空白的成功頁
    function isValidResult(d) {

        return !!(
            d &&
            d.ok === true &&
            d.kind === "register" &&
            d.regId &&
            d.courseName &&
            d.bank &&
            d.bank.account
        );

    }


    form.addEventListener("submit", async (ev) => {

        ev.preventDefault();

        if (submitting) {
            return;
        }

        formErrorEl.textContent = "";

        const values = collect();

        const errs = validate(values);

        showErrors(errs);

        if (Object.keys(errs).length) {
            return;
        }

        submitting = true;
        submitBtn.disabled = true;
        submitBtn.textContent = "送出中…";

        const payload = Object.assign(
            { action: "register", contractVersion: CONTRACT_VERSION },
            values
        );

        try {

            // 用 text/plain，避免瀏覽器的預檢請求（Apps Script 不處理）
            const res = await timeoutFetch(
                API_URL,
                {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify(payload)
                },
                POST_TIMEOUT_MS
            );

            const data = await res.json();

            if (isValidResult(data)) {

                saveResult(data);
                showResult(data);

            } else if (data && data.ok === false && data.error) {

                formErrorEl.textContent = data.error;

            } else {

                console.error("[register] 非預期的回傳：", data);

                formErrorEl.textContent = MSG_UNCERTAIN;

            }

        } catch (err) {

            console.error("[register] 送出失敗：", err);

            formErrorEl.textContent = MSG_UNCERTAIN;

        } finally {

            submitting = false;
            submitBtn.textContent = "送出報名";
            updateSubmitState();

        }

    });


    /* =====================================================
       07. 成功畫面
       ===================================================== */

    function showResult(d) {

        $("res-regId").textContent = d.regId;
        $("res-course").textContent = d.courseName;
        $("res-date").textContent = d.date ? fmtDate(d.date) : "";
        $("res-price").textContent = fmtMoney(d.price || 0);
        $("res-deadline").textContent = d.deadlineText || "";
        $("res-payDue").textContent = d.payDueText || d.deadlineText || "";

        $("res-bankCode").textContent = d.bank.code;
        $("res-bankAccount").textContent = d.bank.account;
        $("res-bankName").textContent = d.bank.name;

        // 每堂日程
        const schedRow = $("res-schedule-row");
        const schedBox = $("res-schedule");

        schedBox.textContent = "";

        if (d.schedule && d.schedule.length) {

            d.schedule.forEach((x, i) => {
                schedBox.appendChild(scheduleItem(x, i));
            });

            schedRow.hidden = false;

        } else {

            schedRow.hidden = true;

        }

        $("res-resumed").hidden = !d.resumed;
        $("res-waitlist").hidden = !d.waitlist;
        $("res-mailok").hidden = !d.emailSent;
        $("res-mailfail").hidden = !!d.emailSent;
        $("res-sender").textContent = SENDER_EMAIL;

        form.hidden = true;
        resultEl.hidden = false;

        const title = $("result-title");

        title.scrollIntoView({ behavior: "smooth", block: "start" });
        title.focus({ preventScroll: true });

    }


    // 送出成功後把結果存在這個分頁，重新整理也不會消失
    const SAVE_KEY = "jg_reg_result";
    const SAVE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

    function saveResult(d) {

        try {

            sessionStorage.setItem(
                SAVE_KEY,
                JSON.stringify({ savedAt: Date.now(), data: d })
            );

        } catch (e) { /* 儲存失敗不影響流程 */ }

    }

    function readSavedResult() {

        try {

            const raw = sessionStorage.getItem(SAVE_KEY);

            if (!raw) {
                return null;
            }

            const o = JSON.parse(raw);

            if (
                !o || !o.data ||
                Date.now() - o.savedAt > SAVE_MAX_AGE_MS ||
                !isValidResult(o.data)
            ) {
                return null;
            }

            return o.data;

        } catch (e) {

            return null;

        }

    }

    $("res-new").addEventListener("click", () => {

        try {
            sessionStorage.removeItem(SAVE_KEY);
        } catch (e) { /* 略過 */ }

        window.location.reload();

    });


    // 複製按鈕
    document.querySelectorAll("[data-copy]").forEach((btn) => {

        btn.addEventListener("click", async () => {

            const text = $(btn.getAttribute("data-copy")).textContent;

            let ok = false;

            try {

                await navigator.clipboard.writeText(text);
                ok = true;

            } catch (e) {

                // 備用：舊瀏覽器
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();

                try {
                    ok = document.execCommand("copy");
                } catch (e2) {
                    ok = false;
                }

                document.body.removeChild(ta);

            }

            const old = btn.textContent;

            btn.textContent = ok ? "已複製" : "請長按選取";

            setTimeout(() => { btn.textContent = old; }, 1600);

        });

    });


    /* =====================================================
       啟動
       ===================================================== */

    async function init() {

        const saved = readSavedResult();

        if (saved) {

            loadingEl.hidden = true;
            showResult(saved);
            return;

        }

        try {

            const all = await loadSessions();

            sessions = all.filter(
                (s) => !courseFilter || s.course === courseFilter
            );

            loadingEl.hidden = true;

            if (!sessions.length) {

                fallbackEl.hidden = false;

                fallbackEl.querySelector("p").innerHTML =
                    "目前沒有開放報名的梯次。<br>" +
                    "如有疑問，歡迎以 IG 或 email 私訊。";

                return;

            }

            renderSessions();

            applyTerms();

            form.hidden = false;

            updateSubmitState();

        } catch (err) {

            console.error("[register] 梯次載入失敗：", err);

            loadingEl.hidden = true;
            fallbackEl.hidden = false;

        }

    }

    init();

})();
