/* =====================================================
JAMES GAZE
model-book.js — Model 檔期頁（自選檔期＋簽署授權書）

網址：model-book.html?m=Model編號&k=24碼（Model 專屬連結，永久有效）
API（POST，Content-Type: text/plain）：
  modelHubLookup、modelHubPreview、modelHubBook
換正式網址時，更新下面的 API_URL（與 register.js 相同）。
===================================================== */

(function () {
    'use strict';

    var API_URL = 'https://script.google.com/macros/s/AKfycbwC-LG0gskNwglEwla2FloU5rr2MiMkKCq9srZz92iKzOHgFOsVSNzVvh8DANPHbwbxMw/exec';
    var FALLBACK_MSG = '系統暫時無法處理，請以 IG 或 email 私訊告訴我，我會手動為您登記。';

    var params = new URLSearchParams(window.location.search);
    var modelId = params.get('m') || '';
    var token = params.get('k') || '';

    function $(id) { return document.getElementById(id); }

    var lead = $('mb-lead');
    var loading = $('mb-loading');
    var closedBox = $('mb-closed');
    var step1 = $('mb-step1');
    var form = $('mb-form');
    var doneBox = $('mb-done');
    var data = null;       // modelHubLookup 結果
    var preview = null;    // modelHubPreview 結果
    var busy = false;

    function post(body) {
        body.modelId = modelId;
        body.token = token;
        var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 30000) : null;
        return fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body),
            signal: ctrl ? ctrl.signal : undefined
        }).then(function (r) { return r.json(); }).then(function (d) {
            if (timer) clearTimeout(timer);
            return d;
        }, function (e) {
            if (timer) clearTimeout(timer);
            throw e;
        });
    }

    function hideAll() {
        loading.hidden = true;
        closedBox.hidden = true;
        step1.hidden = true;
        form.hidden = true;
        doneBox.hidden = true;
    }

    function showClosed(msg) {
        hideAll();
        lead.textContent = '';
        $('mb-closed-text').textContent = msg;
        closedBox.hidden = false;
    }

    function money(n) { return 'NT$' + Number(n).toLocaleString('en-US'); }

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    /* ---------- 第一步：選擇檔期 ---------- */

    function currentMode() {
        var r = document.querySelector('input[name="mode"]:checked');
        return r ? r.value : '';
    }

    function checkedSlots() {
        var out = [];
        var boxes = document.querySelectorAll('input[name="slot"]');
        for (var i = 0; i < boxes.length; i++) if (boxes[i].checked && !boxes[i].dataset.mine) out.push(boxes[i].value);
        return out;
    }

    function renderStep1() {
        hideAll();
        var m = data.model;
        lead.textContent = m.shown + ' 您好。' + (m.count >= 1
            ? '您目前同時最多可有 3 堂尚未拍攝的檔期，還能再選 ' + m.allowance + ' 堂。'
            : '您是第一次合作，同時只能選 1 堂；完成第一次拍攝後，就能同時選到 3 堂。');
        $('mb-pay-label').textContent = '付費（每堂 ' + money(data.pay) + '，約 ' + data.hours + ' 小時，拍攝日當天匯款）';
        $('mb-deal-label').textContent = '互惠（每堂提供：' + data.deliver + '）';

        var mineBox = $('mb-mine');
        var mineList = $('mb-mine-list');
        mineList.textContent = '';
        mineBox.hidden = !data.mine.length;
        data.mine.forEach(function (x) {
            var li = el('li', '', x.dateText + ' ' + x.time + '　' + x.theme + '　');
            var a = el('a', '', x.signed ? '確認出席／取消' : '前往簽署');
            a.href = x.url;
            li.appendChild(a);
            mineList.appendChild(li);
        });

        var box = $('mb-slots');
        box.textContent = '';
        $('mb-empty').hidden = data.slots.length > 0;
        var lastGroup = '';
        data.slots.forEach(function (s, idx) {
            if (s.sessionLabel !== lastGroup) {
                lastGroup = s.sessionLabel;
                box.appendChild(el('p', 'mb-group', s.sessionLabel));
            }
            var lab = el('label', 'mb-slot');
            lab.setAttribute('for', 'slot-' + idx);
            var row = el('div', 'reg-check');
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = 'slot-' + idx;
            cb.name = 'slot';
            cb.value = s.key;
            if (s.mine) { cb.checked = true; cb.disabled = true; cb.dataset.mine = '1'; }
            row.appendChild(cb);
            var body = el('span', 'mb-slot-body');
            body.appendChild(el('span', 'mb-slot-title', s.dateText + ' ' + s.time + ' 起，約 ' + s.hours + ' 小時'));
            body.appendChild(el('span', 'mb-slot-meta', (s.area || '') + (s.seq ? '・第 ' + s.seq + ' 堂' : '') + (s.topic ? '・' + s.topic : '') +
                '・' + s.theme + '・' + (s.modeAllowed === '都可' ? '付費或互惠' : '僅限' + s.modeAllowed)));
            var note = el('span', 'mb-slot-note', s.confirmText || '');
            note.dataset.base = s.confirmText || '';
            body.appendChild(note);
            row.appendChild(body);
            lab.appendChild(row);
            lab.dataset.mode = s.modeAllowed;
            lab.dataset.full = s.full ? '1' : '';
            lab.dataset.mine = s.mine ? '1' : '';
            lab.dataset.conflict = s.conflict ? '1' : '';
            box.appendChild(lab);
        });
        updateState();
        step1.hidden = false;
    }

    function updateState() {
        var mode = currentMode();
        var picked = checkedSlots().length;
        var allowance = data.model.allowance;
        var labels = document.querySelectorAll('.mb-slot');
        for (var i = 0; i < labels.length; i++) {
            var lab = labels[i];
            var cb = lab.querySelector('input');
            var note = lab.querySelector('.mb-slot-note');
            var why = '';
            if (lab.dataset.mine) why = '您已選了這一堂';
            else if (lab.dataset.full) why = '已額滿';
            else if (lab.dataset.conflict) why = '與您已有的場次時間重疊';
            else if (mode && lab.dataset.mode !== '都可' && lab.dataset.mode !== mode) why = '這一堂只開放「' + lab.dataset.mode + '」';
            else if (!cb.checked && picked >= allowance) why = allowance === 0 ? '已達同時可選的上限' : '已選滿 ' + allowance + ' 堂';
            if (why && !lab.dataset.mine) {
                if (cb.checked) cb.checked = false;
                cb.disabled = true;
            } else if (!lab.dataset.mine) {
                cb.disabled = false;
            }
            lab.classList.toggle('is-disabled', !!why && !lab.dataset.mine);
            lab.classList.toggle('is-selected', cb.checked && !lab.dataset.mine);
            note.textContent = why && !lab.dataset.mine ? why : (note.dataset.base || '');
        }
        $('mb-next').disabled = !(mode && checkedSlots().length);
        $('mb-allow').textContent = data.slots.length
            ? '先選合作形式，再勾選檔期；先選先得。還能選 ' + Math.max(0, allowance - checkedSlots().length) + ' 堂。' : '';
    }

    step1.addEventListener('change', function () { $('mb-step1-error').textContent = ''; updateState(); });

    $('mb-next').addEventListener('click', function () {
        if (busy) return;
        busy = true;
        var btn = this;
        btn.disabled = true;
        $('mb-step1-error').textContent = '';
        post({ action: 'modelHubPreview', mode: currentMode(), slots: checkedSlots() }).then(function (d) {
            if (d && d.ok) { preview = d; showForm(); }
            else {
                $('mb-step1-error').textContent = (d && d.error) || FALLBACK_MSG;
                $('mb-step1-error').scrollIntoView({ block: 'center' });
            }
        }).catch(function () {
            $('mb-step1-error').textContent = FALLBACK_MSG;
        }).then(function () { busy = false; updateState(); });
    });

    /* ---------- 第二步：授權書與簽名 ---------- */

    function row(dt, dd) {
        var d = document.createElement('div');
        var a = document.createElement('dt'); a.textContent = dt;
        var b = document.createElement('dd'); b.textContent = dd;
        d.appendChild(a); d.appendChild(b);
        return d;
    }

    function showForm() {
        hideAll();
        var t = preview.terms;
        lead.textContent = '請確認所選檔期與授權書內容，補上資料後簽名送出。送出後，授權書 PDF 會寄到您的 Email。';
        var sum = $('mb-summary');
        sum.textContent = '';
        var picks = data.slots.filter(function (s) { return checkedSlots().indexOf(s.key) >= 0; });
        picks.forEach(function (s, i) {
            sum.appendChild(row(picks.length > 1 ? '場次' + (i + 1) : '場次', s.dateText + ' ' + s.time + ' 起，約 ' + s.hours + ' 小時；' + (s.area || '') + '；' + s.theme));
        });
        sum.appendChild(row('合作形式', preview.mode === '付費' ? '付費（每堂 ' + money(data.pay) + '）' : '互惠（' + data.deliver + '）'));

        var box = $('mb-terms');
        box.textContent = '';
        t.parties.forEach(function (p) { box.appendChild(el('p', '', p)); });
        t.sections.forEach(function (s) {
            box.appendChild(el('h2', '', s.title));
            (s.plain || []).forEach(function (p) { box.appendChild(el('p', '', p)); });
            s.paras.forEach(function (p) { box.appendChild(el('p', '', p)); });
        });
        $('mb-version').textContent = '版本：' + t.version;
        $('mb-identity').textContent = preview.shown + ' 您好，Email（' + preview.emailMasked + '）與 IG 已在資料庫，不需重填。';
        $('mb-bank').hidden = !preview.needBank;
        $('mb-tag-ig-label').textContent = '標註我的 Instagram 帳號' + (preview.ig ? '（' + preview.ig + '）' : '');
        $('mb-tag-nick-label').textContent = '僅標註我的暱稱（' + preview.shown + '）';
        $('mb-sensitive').hidden = !preview.sensitive;
        if (preview.sensitive) {
            $('mb-sensitive-label').textContent = '我了解所選場次的拍攝內容涉及「' + preview.sensitiveThemes.join('、') +
                '」，同意拍攝與公開使用範圍如授權書所載，並同意於拍攝當日出示身分證件供甲方核對年齡，未核對前不開始拍攝';
        }
        form.hidden = false;
        initCanvas();
        window.scrollTo(0, 0);
    }

    $('mb-back').addEventListener('click', function () {
        form.hidden = true;
        lead.textContent = '';
        renderStep1();
    });

    var canvas, ctx, drawing = false, points = 0;

    function initCanvas() {
        canvas = $('ms-canvas');
        ctx = canvas.getContext ? canvas.getContext('2d') : null;
        if (!ctx) return;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        points = 0;
        if (canvas.__bound) return;
        canvas.__bound = true;
        function pos(ev) {
            var r = canvas.getBoundingClientRect();
            var w = r.width || canvas.width;
            var h = r.height || canvas.height;
            return { x: (ev.clientX - r.left) * canvas.width / w, y: (ev.clientY - r.top) * canvas.height / h };
        }
        canvas.addEventListener('pointerdown', function (ev) {
            ev.preventDefault();
            drawing = true;
            if (canvas.setPointerCapture) { try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ } }
            var p = pos(ev);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + 0.1, p.y + 0.1);
            ctx.stroke();
            points += 1;
        });
        canvas.addEventListener('pointermove', function (ev) {
            if (!drawing) return;
            ev.preventDefault();
            var p = pos(ev);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            points += 1;
        });
        function end() { drawing = false; }
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        canvas.addEventListener('pointerleave', end);
        $('ms-clear').addEventListener('click', function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            points = 0;
        });
    }

    function setError(name, msg) {
        var boxE = form.querySelector('[data-error-for="' + name + '"]');
        if (boxE) boxE.textContent = msg || '';
        var f = form.elements[name];
        if (f && f.nodeType === 1) {
            if (msg) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid');
        }
        if (name === 'signature') {
            var s = form.querySelector('.ms-sign');
            if (s) s.classList.toggle('is-invalid', !!msg);
        }
    }

    function clearErrors() {
        var boxes = form.querySelectorAll('[data-error-for]');
        for (var i = 0; i < boxes.length; i++) boxes[i].textContent = '';
        var bad = form.querySelectorAll('[aria-invalid]');
        for (var j = 0; j < bad.length; j++) bad[j].removeAttribute('aria-invalid');
        var s = form.querySelector('.ms-sign');
        if (s) s.classList.remove('is-invalid');
        $('mb-form-error').textContent = '';
    }

    function val(id) { return $(id).value.trim(); }
    function chosenTag() {
        var r = form.querySelector('input[name="tag"]:checked');
        return r ? r.value : '';
    }

    function validate() {
        var e = {};
        if (!/^09\d{8}$/.test(val('f-phone').replace(/[\s-]/g, ''))) e.phone = '請填寫 10 碼手機號碼（例如 0912345678）。';
        if (preview.needBank) {
            if (!/^\d{3,7}$/.test(val('f-bankCode').replace(/\s/g, ''))) e.bankCode = '銀行代碼請填 3 到 7 位數字。';
            if (!/^\d{6,16}$/.test(val('f-account').replace(/[\s-]/g, ''))) e.account = '匯款帳號請填 6 到 16 位數字。';
            if (val('f-accountName').length < 2) e.accountName = '請填寫匯款戶名。';
        }
        if (!chosenTag()) e.tag = '請選擇公開作品時的標註方式。';
        if (!$('f-agreed').checked) e.agreed = '請先閱讀並勾選同意。';
        if (preview.sensitive && !$('f-sensitiveOk').checked) e.sensitiveOk = '請勾選拍攝內容的額外同意事項。';
        if (!ctx || points < 15) e.signature = '請在框內手寫簽名。';
        return e;
    }

    function showErrors(errs) {
        var first = null;
        Object.keys(errs).forEach(function (k) { setError(k, errs[k]); if (!first) first = k; });
        if (!first) return;
        var t = first === 'signature' ? $('ms-canvas') : form.elements[first];
        if (t && t.nodeType === 1 && t.scrollIntoView) t.scrollIntoView({ block: 'center' });
        if (t && t.nodeType === 1 && t.focus && first !== 'signature') t.focus();
    }

    form.addEventListener('input', function (ev) { var n = ev.target && ev.target.name; if (n) setError(n, ''); });
    form.addEventListener('change', function (ev) { var n = ev.target && ev.target.name; if (n) setError(n, ''); });

    form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (busy || !preview) return;
        clearErrors();
        var errs = validate();
        if (Object.keys(errs).length) { showErrors(errs); return; }
        busy = true;
        var btn = $('mb-submit');
        btn.disabled = true;
        btn.textContent = '送出中…';
        post({
            action: 'modelHubBook',
            mode: preview.mode,
            slots: checkedSlots(),
            phone: val('f-phone').replace(/[\s-]/g, ''),
            bankCode: preview.needBank ? val('f-bankCode').replace(/\s/g, '') : '',
            account: preview.needBank ? val('f-account').replace(/[\s-]/g, '') : '',
            accountName: preview.needBank ? val('f-accountName') : '',
            tag: chosenTag(),
            agreed: $('f-agreed').checked === true,
            sensitiveOk: $('f-sensitiveOk').checked === true,
            version: preview.version,
            signature: canvas.toDataURL('image/png'),
            hp_contact: val('f-hp')
        }).then(function (d) {
            if (d && d.ok) {
                showDone(d);
            } else {
                $('mb-form-error').textContent = (d && d.error) || FALLBACK_MSG;
                $('mb-form-error').scrollIntoView({ block: 'center' });
            }
        }).catch(function () {
            $('mb-form-error').textContent = FALLBACK_MSG;
        }).then(function () {
            busy = false;
            btn.disabled = false;
            btn.textContent = '簽署並送出';
        });
    });

    function showDone(d) {
        hideAll();
        lead.textContent = '';
        var notes = $('mb-done-notes');
        notes.textContent = '';
        notes.appendChild(el('li', '', '已確認 ' + d.ids.length + ' 堂檔期。' + (d.emailSent
            ? '授權書 PDF 已寄到 ' + d.emailMasked + '，請查收（沒收到請看垃圾郵件匣）。'
            : '確認信暫時沒有寄出，我會人工補寄給您。')));
        if (!d.pdfReady) notes.appendChild(el('li', '', '授權書 PDF 正在產生，完成後會另外寄給您。'));
        notes.appendChild(el('li', '', '拍攝前 7 天我會再寄一封出席確認信；如果臨時無法到場，請最晚於拍攝前 3 日，從確認信裡的連結取消。'));
        doneBox.hidden = false;
        $('mb-done-title').focus();
    }

    $('mb-again').addEventListener('click', function () { load(); });

    /* ---------- 載入 ---------- */

    function load() {
        loading.hidden = false;
        post({ action: 'modelHubLookup' }).then(function (d) {
            if (!d || !d.ok) { showClosed((d && d.error) || FALLBACK_MSG); return; }
            data = d;
            $('f-mode-1').checked = false;
            $('f-mode-2').checked = false;
            renderStep1();
        }).catch(function () {
            showClosed(FALLBACK_MSG);
        });
    }

    if (!modelId || !token) {
        showClosed('這個連結不完整。請使用甲方寄給您的完整連結，或直接聯絡甲方。');
    } else {
        load();
    }
})();
