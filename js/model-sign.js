/* =====================================================
JAMES GAZE
model-sign.js — Model 簽署與出席確認頁

網址：model-sign.html?b=場次編號&k=24碼（Model 專屬連結）
API（POST，Content-Type: text/plain）：
  modelSignLookup、modelSignConfirm、modelAttend
換正式網址時，更新下面的 API_URL（與 register.js 相同）。
===================================================== */

(function () {
    'use strict';

    var API_URL = 'https://script.google.com/macros/s/AKfycbwC-LG0gskNwglEwla2FloU5rr2MiMkKCq9srZz92iKzOHgFOsVSNzVvh8DANPHbwbxMw/exec';
    var FALLBACK_MSG = '系統暫時無法處理，請以 IG 或 email 私訊告訴我，我會手動為您登記。';

    var params = new URLSearchParams(window.location.search);
    var bookingId = params.get('b') || '';
    var token = params.get('k') || '';

    function $(id) { return document.getElementById(id); }

    var loading = $('ms-loading');
    var closedBox = $('ms-closed');
    var summary = $('ms-summary');
    var form = $('ms-form');
    var signedBox = $('ms-signed');
    var lead = $('ms-lead');
    var current = null;     // 目前的 view
    var busy = false;

    function post(body) {
        body.bookingId = bookingId;
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
        summary.hidden = true;
        form.hidden = true;
        signedBox.hidden = true;
    }

    function showClosed(msg) {
        hideAll();
        lead.textContent = '';
        $('ms-closed-text').textContent = msg;
        closedBox.hidden = false;
    }

    function row(dt, dd) {
        var d = document.createElement('div');
        var a = document.createElement('dt');
        a.textContent = dt;
        var b = document.createElement('dd');
        b.textContent = dd;
        d.appendChild(a);
        d.appendChild(b);
        return d;
    }

    function renderSummary(v, withAddress) {
        summary.textContent = '';
        summary.appendChild(row('日期時間', v.dateText + ' ' + v.time + ' 起，約 ' + v.hours + ' 小時'));
        summary.appendChild(row('地點', v.area + (withAddress && v.address ? '　' + v.address : '') + (v.place ? '（' + v.place + '）' : '')));
        summary.appendChild(row('拍攝內容', v.theme));
        summary.appendChild(row('拍攝要求', v.require || '無'));
        summary.appendChild(row(v.mode === '付費' ? '報酬' : '互惠內容',
            v.mode === '付費' ? 'NT$' + Number(v.amount).toLocaleString('en-US') + '（拍攝日當天匯款）' : v.deliver));
        summary.hidden = false;
    }

    function renderTerms(t) {
        var box = $('ms-terms');
        box.textContent = '';
        t.parties.forEach(function (p) {
            var el = document.createElement('p');
            el.textContent = p;
            box.appendChild(el);
        });
        t.sections.forEach(function (s) {
            var h = document.createElement('h2');
            h.textContent = s.title;
            box.appendChild(h);
            (s.plain || []).forEach(function (p) {
                var el = document.createElement('p');
                el.textContent = p;
                box.appendChild(el);
            });
            s.paras.forEach(function (p) {
                var el = document.createElement('p');
                el.textContent = p;
                box.appendChild(el);
            });
        });
        $('ms-version').textContent = '版本：' + t.version;
    }

    /* ---------- 簽署表單 ---------- */

    function showUnsigned(view, terms) {
        hideAll();
        current = view;
        lead.textContent = '請在 ' + view.signBy + ' 前確認資訊並簽署。簽署後，授權書 PDF 會寄到您的 Email。';
        renderSummary(view, false);
        renderTerms(terms);
        $('ms-identity').textContent = view.shown + ' 您好，Email（' + view.emailMasked + '）與 IG 已在資料庫，不需重填。';
        $('ms-bank').hidden = !view.needBank;
        $('ms-tag-ig-label').textContent = '標註我的 Instagram 帳號' + (view.ig ? '（' + view.ig + '）' : '');
        $('ms-tag-nick-label').textContent = '僅標註我的暱稱（' + view.shown + '）';
        var sens = $('ms-sensitive');
        sens.hidden = !view.sensitive;
        if (view.sensitive) {
            $('ms-sensitive-label').textContent = '我了解本場次拍攝內容為「' + view.theme +
                '」，同意拍攝與公開使用範圍如授權書所載，並同意於拍攝當日出示身分證件供甲方核對年齡，未核對前不開始拍攝';
        }
        form.hidden = false;
        initCanvas();
    }

    var canvas, ctx, drawing = false, points = 0;

    function initCanvas() {
        canvas = $('ms-canvas');
        ctx = canvas.getContext ? canvas.getContext('2d') : null;
        if (!ctx) return;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111';
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
        var box = form.querySelector('[data-error-for="' + name + '"]');
        if (box) box.textContent = msg || '';
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
        $('ms-form-error').textContent = '';
    }

    function val(id) { return $(id).value.trim(); }

    function chosenTag() {
        var r = form.querySelector('input[name="tag"]:checked');
        return r ? r.value : '';
    }

    function validate() {
        var e = {};
        if (!/^09\d{8}$/.test(val('f-phone').replace(/[\s-]/g, ''))) e.phone = '請填寫 10 碼手機號碼（例如 0912345678）。';
        if (current.needBank) {
            if (!/^\d{3,7}$/.test(val('f-bankCode').replace(/\s/g, ''))) e.bankCode = '銀行代碼請填 3 到 7 位數字。';
            if (!/^\d{6,16}$/.test(val('f-account').replace(/[\s-]/g, ''))) e.account = '匯款帳號請填 6 到 16 位數字。';
            if (val('f-accountName').length < 2) e.accountName = '請填寫匯款戶名。';
        }
        if (!chosenTag()) e.tag = '請選擇公開作品時的標註方式。';
        if (!$('f-agreed').checked) e.agreed = '請先閱讀並勾選同意。';
        if (current.sensitive && !$('f-sensitiveOk').checked) e.sensitiveOk = '請勾選本場次的額外同意事項。';
        if (!ctx || points < 15) e.signature = '請在框內手寫簽名。';
        return e;
    }

    function showErrors(errs) {
        var first = null;
        Object.keys(errs).forEach(function (k) {
            setError(k, errs[k]);
            if (!first) first = k;
        });
        if (!first) return;
        var t = first === 'signature' ? $('ms-canvas') : form.elements[first];
        if (t && t.nodeType === 1 && t.scrollIntoView) t.scrollIntoView({ block: 'center' });
        if (t && t.nodeType === 1 && t.focus && first !== 'signature') t.focus();
    }

    form.addEventListener('input', function (ev) {
        var n = ev.target && ev.target.name;
        if (n) setError(n, '');
    });
    form.addEventListener('change', function (ev) {
        var n = ev.target && ev.target.name;
        if (n) setError(n, '');
    });

    form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (busy || !current) return;
        clearErrors();
        var errs = validate();
        if (Object.keys(errs).length) { showErrors(errs); return; }

        busy = true;
        var btn = $('ms-submit');
        btn.disabled = true;
        btn.textContent = '送出中…';

        post({
            action: 'modelSignConfirm',
            phone: val('f-phone').replace(/[\s-]/g, ''),
            bankCode: current.needBank ? val('f-bankCode').replace(/\s/g, '') : '',
            account: current.needBank ? val('f-account').replace(/[\s-]/g, '') : '',
            accountName: current.needBank ? val('f-accountName') : '',
            tag: chosenTag(),
            agreed: $('f-agreed').checked === true,
            sensitiveOk: $('f-sensitiveOk').checked === true,
            version: current.version,
            signature: canvas.toDataURL('image/png'),
            hp_contact: val('f-hp')
        }).then(function (d) {
            if (d && d.ok) {
                var note = d.emailSent
                    ? '已簽署完成。授權書 PDF 已寄到 ' + current.emailMasked + '，請查收（沒收到請看垃圾郵件匣）。'
                    : '已簽署完成，但確認信暫時沒有寄出，我會人工補寄給您。';
                if (!d.pdfReady) note += '授權書 PDF 正在產生，完成後會另外寄給您。';
                lookup(note);
            } else {
                $('ms-form-error').textContent = (d && d.error) || FALLBACK_MSG;
                $('ms-form-error').scrollIntoView({ block: 'center' });
            }
        }).catch(function () {
            $('ms-form-error').textContent = FALLBACK_MSG;
            $('ms-form-error').scrollIntoView({ block: 'center' });
        }).then(function () {
            busy = false;
            btn.disabled = false;
            btn.textContent = '簽署並送出';
        });
    });

    /* ---------- 已簽署：出席確認與取消 ---------- */

    function showSigned(view, note) {
        hideAll();
        current = view;
        lead.textContent = view.shown + ' 您好，您已簽署這個場次的授權書。';
        renderSummary(view, true);
        var n = $('ms-signed-note');
        if (note) { n.textContent = note; n.hidden = false; n.style.borderLeftColor = '#1f7a3d'; n.style.color = '#111'; n.style.background = '#eef6f0'; }
        else { n.hidden = true; }
        var att = $('ms-attend');
        var ok = view.attend === '已確認';
        att.textContent = ok
            ? '您已確認出席。如果臨時無法到場，' + (view.canCancel ? '最晚 ' + view.cancelBy + ' 前可以在這裡取消。' : '請直接聯絡甲方。')
            : '請確認您會準時出席（遲到逾 ' + (view.lateMin || 60) + ' 分鐘視為缺席）。';
        att.className = 'ms-attend' + (ok ? ' is-ok' : '');
        $('ms-confirm').hidden = ok;
        $('ms-cancel').hidden = !view.canCancel;
        $('ms-cancel-hint').textContent = view.canCancel
            ? '可線上取消的期限：' + view.cancelBy + '（拍攝日前 3 日）。'
            : '已超過可線上取消的期限（拍攝日前 3 日）。如無法到場，請直接以 IG（@jamesgaze）或 Email 聯絡甲方；未依期限通知而無法到場者，依授權書第六條視為缺席。';
        $('ms-signed-error').textContent = '';
        signedBox.hidden = false;
    }

    function attend(act, btn) {
        if (busy) return;
        busy = true;
        btn.disabled = true;
        $('ms-signed-error').textContent = '';
        post({ action: 'modelAttend', act: act }).then(function (d) {
            if (d && d.ok) {
                if (d.cancelled) {
                    showClosed('已取消這個場次，謝謝您提前告知。確認信已寄到您的 Email。');
                } else {
                    lookup('已記錄您的出席確認，謝謝您。');
                }
            } else {
                $('ms-signed-error').textContent = (d && d.error) || FALLBACK_MSG;
            }
        }).catch(function () {
            $('ms-signed-error').textContent = FALLBACK_MSG;
        }).then(function () {
            busy = false;
            btn.disabled = false;
        });
    }

    $('ms-confirm').addEventListener('click', function () { attend('confirm', this); });
    $('ms-cancel').addEventListener('click', function () {
        if (!window.confirm('確定要取消這個場次嗎？取消後無法復原。')) return;
        attend('cancel', this);
    });

    /* ---------- 載入 ---------- */

    function lookup(note) {
        post({ action: 'modelSignLookup' }).then(function (d) {
            if (!d || !d.ok) { showClosed((d && d.error) || FALLBACK_MSG); return; }
            if (d.state === 'unsigned') showUnsigned(d.view, d.terms);
            else if (d.state === 'signed') showSigned(d.view, note);
            else showClosed(d.message || '這個連結已失效。');
        }).catch(function () {
            showClosed(FALLBACK_MSG);
        });
    }

    if (!bookingId || !token) {
        showClosed('這個連結不完整。請使用甲方傳給您的完整連結，或直接聯絡甲方。');
    } else {
        lookup('');
    }
})();
