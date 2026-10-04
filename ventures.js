// Venture Forge page: animated market chart in the hero, Finance Lab tools
// (SIP planner, options payoff, EOQ optimiser) and count-up metrics.
(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
    const num = n => Math.round(n).toLocaleString('en-IN');

    // Compact rupee formatting for chart axes: ₹1.2Cr, ₹45L, ₹12K
    function inrShort(n) {
        const a = Math.abs(n), sign = n < 0 ? '-' : '';
        if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
        if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
        if (a >= 1e3) return `${sign}₹${(a / 1e3).toFixed(0)}K`;
        return `${sign}₹${Math.round(a)}`;
    }

    /* ---------------------------------------------------------------
       Hero: a market line that keeps drawing itself, with candles
       --------------------------------------------------------------- */
    const canvas = document.getElementById('marketCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let w = 0, h = 0, points = [], candles = [], offset = 0;
        const STEP = 14;

        function seed() {
            const n = Math.ceil(w / STEP) + 4;
            let v = 0.55;
            points = Array.from({ length: n }, () => (v = nextValue(v)));
            candles = Array.from({ length: Math.ceil(w / 38) + 2 }, makeCandle);
        }

        // Mean-reverting random walk with a gentle upward drift
        function nextValue(v) {
            v += (Math.random() - 0.47) * 0.06 + (0.55 - v) * 0.04;
            return Math.min(0.85, Math.max(0.25, v));
        }

        function makeCandle() {
            const mid = 0.35 + Math.random() * 0.4;
            const body = 0.02 + Math.random() * 0.06;
            return { mid, body, wick: body + Math.random() * 0.05, up: Math.random() > 0.42 };
        }

        function resize() {
            const r = canvas.getBoundingClientRect();
            if (!r.width || !r.height) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = r.width; h = r.height;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
        }
        new ResizeObserver(resize).observe(canvas);
        resize();

        function draw() {
            if (!w) return;
            ctx.clearRect(0, 0, w, h);

            // Faint candlesticks in the background
            candles.forEach((c, i) => {
                const x = i * 38 - (offset * 0.4) % 38;
                const color = c.up ? 'rgba(61,255,154,0.10)' : 'rgba(255,92,122,0.09)';
                ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + 6, h * (1 - c.mid - c.wick));
                ctx.lineTo(x + 6, h * (1 - c.mid + c.wick));
                ctx.stroke();
                ctx.fillRect(x, h * (1 - c.mid - c.body), 12, h * c.body * 2);
            });

            // Price line with gradient fill
            const shift = offset % STEP;
            ctx.beginPath();
            points.forEach((p, i) => {
                const x = i * STEP - shift, y = h * (1 - p);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            });
            const grad = ctx.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0, 'rgba(61,255,154,0.05)');
            grad.addColorStop(0.6, 'rgba(61,255,154,0.45)');
            grad.addColorStop(1, 'rgba(46,230,255,0.8)');
            ctx.strokeStyle = grad; ctx.lineWidth = 2;
            ctx.stroke();

            ctx.lineTo(w + STEP, h); ctx.lineTo(-STEP, h); ctx.closePath();
            const fill = ctx.createLinearGradient(0, h * 0.2, 0, h);
            fill.addColorStop(0, 'rgba(61,255,154,0.10)');
            fill.addColorStop(1, 'rgba(61,255,154,0)');
            ctx.fillStyle = fill;
            ctx.fill();

            // Glowing "live" dot riding the line near the right edge
            const dotX = w - 48;
            const fi = (dotX + shift) / STEP, i0 = Math.floor(fi), t = fi - i0;
            if (points[i0 + 1] !== undefined) {
                const dotY = h * (1 - (points[i0] * (1 - t) + points[i0 + 1] * t));
                ctx.beginPath();
                ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#2ee6ff';
                ctx.shadowColor = '#2ee6ff'; ctx.shadowBlur = 14;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        let visible = true;
        new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
        // Scroll left; each time a full step passes, drop the oldest point and add a new one
        let steps = 0, candleSteps = 0;
        function loop() {
            if (visible) {
                offset += 0.6;
                const s = Math.floor(offset / STEP);
                while (steps < s) { points.shift(); points.push(nextValue(points[points.length - 1])); steps++; }
                const c = Math.floor(offset * 0.4 / 38);
                while (candleSteps < c) { candles.shift(); candles.push(makeCandle()); candleSteps++; }
                draw();
            }
            requestAnimationFrame(loop);
        }
        if (reduceMotion) draw(); else requestAnimationFrame(loop);
    }

    /* ---------------------------------------------------------------
       Small SVG charting helper shared by the three tools
       --------------------------------------------------------------- */
    const VB = { w: 600, h: 360, l: 64, r: 16, t: 16, b: 34 };
    const SVGNS = 'http://www.w3.org/2000/svg';

    function el(tag, attrs, parent) {
        const e = document.createElementNS(SVGNS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(e);
        return e;
    }

    // series: [{ pts: [[x,y]...], cls, area }], opts: { xMin,xMax,yMin,yMax,xFmt,yFmt,marks }
    function plot(svg, series, o) {
        svg.textContent = '';
        const X = x => VB.l + (x - o.xMin) / (o.xMax - o.xMin) * (VB.w - VB.l - VB.r);
        const Y = y => VB.t + (1 - (y - o.yMin) / (o.yMax - o.yMin)) * (VB.h - VB.t - VB.b);

        // Grid + axis labels
        for (let i = 0; i <= 4; i++) {
            const yv = o.yMin + (o.yMax - o.yMin) * i / 4;
            el('line', { x1: VB.l, x2: VB.w - VB.r, y1: Y(yv), y2: Y(yv), class: 'ch-grid' }, svg);
            el('text', { x: VB.l - 8, y: Y(yv) + 4, class: 'ch-label', 'text-anchor': 'end' }, svg).textContent = o.yFmt(yv);
        }
        for (let i = 0; i <= 4; i++) {
            const xv = o.xMin + (o.xMax - o.xMin) * i / 4;
            el('text', { x: X(xv), y: VB.h - 10, class: 'ch-label', 'text-anchor': i === 0 ? 'start' : i === 4 ? 'end' : 'middle' }, svg).textContent = o.xFmt(xv);
        }
        if (o.yMin < 0 && o.yMax > 0) el('line', { x1: VB.l, x2: VB.w - VB.r, y1: Y(0), y2: Y(0), class: 'ch-zero' }, svg);

        series.forEach(s => {
            const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
            if (s.area) el('path', { d: `${d}L${X(s.pts[s.pts.length - 1][0])},${Y(Math.max(o.yMin, 0))}L${X(s.pts[0][0])},${Y(Math.max(o.yMin, 0))}Z`, class: s.area }, svg);
            if (s.clip) {
                // Split a payoff line into profit (above zero) and loss (below zero) colours
                const id = 'c' + Math.random().toString(36).slice(2);
                const defs = el('defs', {}, svg);
                const cp = el('clipPath', { id: id + 'u' }, defs);
                el('rect', { x: 0, y: 0, width: VB.w, height: Y(0) }, cp);
                const cn = el('clipPath', { id: id + 'd' }, defs);
                el('rect', { x: 0, y: Y(0), width: VB.w, height: VB.h }, cn);
                el('path', { d, class: 'ch-line up', 'clip-path': `url(#${id}u)` }, svg);
                el('path', { d, class: 'ch-line down', 'clip-path': `url(#${id}d)` }, svg);
            } else {
                el('path', { d, class: 'ch-line ' + s.cls }, svg);
            }
        });

        (o.marks || []).forEach(m => {
            el('line', { x1: X(m.x), x2: X(m.x), y1: VB.t, y2: VB.h - VB.b, class: 'ch-mark' }, svg);
            el('circle', { cx: X(m.x), cy: Y(m.y), r: 5, class: 'ch-dot' }, svg);
            const right = X(m.x) > VB.w * 0.7;
            el('text', { x: X(m.x) + (right ? -8 : 8), y: VB.t + 14, class: 'ch-tag', 'text-anchor': right ? 'end' : 'start' }, svg).textContent = m.label;
        });
    }

    function niceMax(v) {
        if (v <= 0) return 1;
        const p = Math.pow(10, Math.floor(Math.log10(v)));
        return Math.ceil(v / p * 2) / 2 * p;
    }

    const $ = id => document.getElementById(id);
    function bind(ids, fn) { ids.forEach(id => $(id).addEventListener('input', fn)); fn(); }

    // Fill each range slider's track up to its thumb
    function paintRanges() {
        document.querySelectorAll('.lab-field input[type=range]').forEach(r => {
            const pct = (r.value - r.min) / (r.max - r.min) * 100;
            r.style.setProperty('--fill', pct + '%');
        });
    }
    document.addEventListener('input', e => { if (e.target.matches('.lab-field input[type=range]')) paintRanges(); });

    /* ---------------------------------------------------------------
       01 · SIP planner
       FV = P × [((1 + i)^n − 1) / i] × (1 + i), i = monthly rate
       --------------------------------------------------------------- */
    if ($('sipChart')) bind(['sipAmt', 'sipYrs', 'sipRate'], () => {
        const P = +$('sipAmt').value, years = +$('sipYrs').value, rate = +$('sipRate').value;
        const i = rate / 12 / 100;
        $('sipAmtOut').textContent = inr(P);
        $('sipYrsOut').textContent = years + (years === 1 ? ' year' : ' years');
        $('sipRateOut').textContent = rate + '%';

        const fv = m => P * ((Math.pow(1 + i, m) - 1) / i) * (1 + i);
        const value = [], invested = [];
        for (let y = 0; y <= years; y++) { value.push([y, fv(y * 12)]); invested.push([y, P * 12 * y]); }

        const total = fv(years * 12), put = P * 12 * years;
        $('sipInvested').textContent = inr(put);
        $('sipGains').textContent = inr(total - put);
        $('sipTotal').textContent = inr(total);

        plot($('sipChart'), [
            { pts: value, cls: 'a', area: 'ch-area a' },
            { pts: invested, cls: 'b', area: 'ch-area b' }
        ], { xMin: 0, xMax: years, yMin: 0, yMax: niceMax(total), xFmt: v => 'Yr ' + Math.round(v), yFmt: inrShort });
    });

    /* ---------------------------------------------------------------
       02 · Options payoff at expiry (per unit × quantity)
       --------------------------------------------------------------- */
    let strategy = 'call';
    document.querySelectorAll('#optStrategy button').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('#optStrategy button').forEach(x => x.classList.toggle('active', x === b));
        strategy = b.dataset.s;
        drawOptions();
    }));

    function drawOptions() {
        const K = +$('optStrike').value, prem = +$('optPrem').value, q = +$('optQty').value;
        $('optStrikeOut').textContent = inr(K);
        $('optPremOut').textContent = inr(prem);
        $('optQtyOut').textContent = num(q);

        const payoff = S => q * (
            strategy === 'call' ? Math.max(S - K, 0) - prem :
            strategy === 'put' ? Math.max(K - S, 0) - prem :
            Math.abs(S - K) - prem            // straddle: premium = total for call + put
        );

        const lo = Math.max(0, K * 0.6), hi = K * 1.4, pts = [];
        for (let k = 0; k <= 120; k++) { const S = lo + (hi - lo) * k / 120; pts.push([S, payoff(S)]); }
        const ys = pts.map(p => p[1]);
        const yMax = niceMax(Math.max(...ys, q * prem));
        const yMin = -niceMax(q * prem * 1.4);

        const marks = [];
        if (strategy === 'call') {
            marks.push({ x: K + prem, y: 0, label: 'BE ' + inr(K + prem) });
            $('optBE').textContent = inr(K + prem);
            $('optProfit').textContent = 'Unlimited';
        } else if (strategy === 'put') {
            marks.push({ x: K - prem, y: 0, label: 'BE ' + inr(K - prem) });
            $('optBE').textContent = inr(K - prem);
            $('optProfit').textContent = inr(q * (K - prem));
        } else {
            marks.push({ x: K - prem, y: 0, label: inr(K - prem) }, { x: K + prem, y: 0, label: inr(K + prem) });
            $('optBE').textContent = `${inr(K - prem)} / ${inr(K + prem)}`;
            $('optProfit').textContent = 'Unlimited';
        }
        $('optLoss').textContent = '−' + inr(q * prem);

        plot($('optChart'), [{ pts, clip: true }], {
            xMin: lo, xMax: hi, yMin, yMax, xFmt: v => inr(v), yFmt: inrShort,
            marks: marks.filter(m => m.x >= lo && m.x <= hi)
        });
    }
    if ($('optChart')) bind(['optStrike', 'optPrem', 'optQty'], drawOptions);

    /* ---------------------------------------------------------------
       03 · EOQ: Q* = √(2DS / H), total cost = (D/Q)·S + (Q/2)·H
       --------------------------------------------------------------- */
    if ($('eoqChart')) bind(['eoqD', 'eoqS', 'eoqH'], () => {
        const D = +$('eoqD').value, S = +$('eoqS').value, H = +$('eoqH').value;
        $('eoqDOut').textContent = num(D);
        $('eoqSOut').textContent = inr(S);
        $('eoqHOut').textContent = inr(H);

        const Q = Math.sqrt(2 * D * S / H);
        const cost = q => D / q * S + q / 2 * H;
        $('eoqQ').textContent = num(Q) + ' units';
        $('eoqN').textContent = (D / Q).toFixed(1);
        $('eoqTC').textContent = inr(cost(Q));

        const qMax = Q * 3, ord = [], hold = [], tot = [];
        for (let k = 1; k <= 120; k++) {
            const q = qMax * k / 120;
            ord.push([q, D / q * S]); hold.push([q, q / 2 * H]); tot.push([q, cost(q)]);
        }
        const yMax = niceMax(cost(Q) * 2.2);
        const clipY = pts => pts.map(([x, y]) => [x, Math.min(y, yMax)]);

        plot($('eoqChart'), [
            { pts: clipY(ord), cls: 'b' },
            { pts: clipY(hold), cls: 'd' },
            { pts: clipY(tot), cls: 'a' }
        ], {
            xMin: 0, xMax: qMax, yMin: 0, yMax, xFmt: v => num(v), yFmt: inrShort,
            marks: [{ x: Q, y: cost(Q), label: 'EOQ ' + num(Q) }]
        });
    });

    paintRanges();

    /* ---------------------------------------------------------------
       Tabs
       --------------------------------------------------------------- */
    const tabs = document.querySelectorAll('.lab-tab');
    tabs.forEach(tab => tab.addEventListener('click', () => {
        tabs.forEach(t => {
            const on = t === tab;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', String(on));
            $('tool-' + t.dataset.tool).hidden = !on;
        });
    }));

    /* ---------------------------------------------------------------
       Count-up metrics
       --------------------------------------------------------------- */
    const counters = document.querySelectorAll('[data-count]');
    if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
        const io = new IntersectionObserver(entries => entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            io.unobserve(entry.target);
            const elmt = entry.target, end = +elmt.dataset.count;
            const pre = elmt.dataset.prefix || '', suf = elmt.dataset.suffix || '';
            // Timer-driven (not rAF) so it always lands on the final value,
            // even if animation frames are throttled
            const t0 = Date.now(), dur = 1200;
            const timer = setInterval(() => {
                const k = Math.min(1, (Date.now() - t0) / dur);
                const eased = 1 - Math.pow(1 - k, 3);
                elmt.textContent = pre + Math.round(end * eased) + suf;
                if (k >= 1) clearInterval(timer);
            }, 40);
        }), { threshold: 0.3 });
        // The real value stays in the HTML; it only counts up from 0 once scrolled into
        // view, so the number is never left at 0 if the animation doesn't run
        counters.forEach(c => io.observe(c));
    }
})();
