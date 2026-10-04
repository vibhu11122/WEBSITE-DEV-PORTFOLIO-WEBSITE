// Creative Pursuits: draw-anywhere sketch pad, "anatomy of a sketch" stepper,
// and a badminton rally mini-game.
(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const storage = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
    };

    /* ---------------------------------------------------------------
       1 · Sketch pad hero
       --------------------------------------------------------------- */
    const pad = document.getElementById('sketchCanvas');
    if (pad) {
        const ctx = pad.getContext('2d');
        let tool = 'graphite', drawing = false, last = null, armed = false;
        let dpr = 1;

        // Resize without losing what's been drawn
        function resize() {
            const r = pad.getBoundingClientRect();
            if (!r.width || !r.height) return;
            const keep = document.createElement('canvas');
            keep.width = pad.width; keep.height = pad.height;
            if (pad.width && pad.height) keep.getContext('2d').drawImage(pad, 0, 0);
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            pad.width = Math.round(r.width * dpr);
            pad.height = Math.round(r.height * dpr);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            if (keep.width) ctx.drawImage(keep, 0, 0);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        new ResizeObserver(resize).observe(pad);
        resize();

        const pos = e => {
            const r = pad.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure && e.pressure !== 0.5 ? e.pressure : 0.5 };
        };

        function stroke(a, b) {
            const dist = Math.hypot(b.x - a.x, b.y - a.y);
            if (tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = 28; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                ctx.globalCompositeOperation = 'source-over';
                return;
            }
            if (tool === 'graphite') {
                // Thin, slightly grainy line: a main stroke plus a faint offset pass
                const w = 1.1 + b.p * 1.4;
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.strokeStyle = 'rgba(48, 47, 52, 0.78)'; ctx.lineWidth = w;
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                ctx.strokeStyle = 'rgba(48, 47, 52, 0.18)'; ctx.lineWidth = w * 0.6;
                ctx.beginPath(); ctx.moveTo(a.x + 0.8, a.y + 0.6); ctx.lineTo(b.x + 0.8, b.y + 0.6); ctx.stroke();
                return;
            }
            // Charcoal: scatter soft grains along the segment for a dusty, textured mark
            const steps = Math.max(1, Math.ceil(dist / 1.5));
            const radius = 7 + b.p * 6;
            for (let i = 0; i < steps; i++) {
                const t = i / steps;
                const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
                for (let k = 0; k < 7; k++) {
                    const ang = Math.random() * Math.PI * 2, r = Math.random() * radius;
                    ctx.fillStyle = `rgba(17, 16, 18, ${0.05 + Math.random() * 0.12})`;
                    ctx.fillRect(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.7, 1.4, 1.4);
                }
            }
        }

        pad.addEventListener('pointerdown', e => {
            // On touch, only draw once a tool has been picked so the page still scrolls
            if (e.pointerType === 'touch' && !armed) return;
            drawing = true; last = pos(e);
            pad.setPointerCapture(e.pointerId);
            stroke(last, { ...last, x: last.x + 0.1 });
        });
        pad.addEventListener('pointermove', e => {
            if (!drawing) return;
            const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
            events.forEach(ev => { const p = pos(ev); stroke(last, p); last = p; });
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => pad.addEventListener(t, () => { drawing = false; }));

        document.querySelectorAll('.sketch-toolbar .tool').forEach(btn => btn.addEventListener('click', () => {
            document.querySelectorAll('.sketch-toolbar .tool').forEach(b => b.classList.toggle('active', b === btn));
            tool = btn.dataset.tool;
            armed = true;
            pad.classList.add('armed');
        }));

        document.getElementById('sketchClear').addEventListener('click', () => {
            ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, pad.width, pad.height);
            ctx.restore();
        });

        // Save the doodle on a paper background
        document.getElementById('sketchSave').addEventListener('click', () => {
            const out = document.createElement('canvas');
            out.width = pad.width; out.height = pad.height;
            const o = out.getContext('2d');
            o.fillStyle = '#f1ebdf'; o.fillRect(0, 0, out.width, out.height);
            o.drawImage(pad, 0, 0);
            o.font = `${28 * dpr}px Caveat, cursive`;
            o.fillStyle = 'rgba(29, 27, 24, 0.55)';
            o.fillText('drawn on vishal trivedi’s sketchbook', 24 * dpr, out.height - 24 * dpr);
            const a = document.createElement('a');
            a.download = 'my-sketch.png';
            a.href = out.toDataURL('image/png');
            a.click();
        });
    }

    /* ---------------------------------------------------------------
       2 · Anatomy of a sketch — four stages, autoplays once on view
       --------------------------------------------------------------- */
    const svg = document.getElementById('anatomySvg');
    if (svg) {
        const steps = document.querySelectorAll('.a-step');
        const stages = svg.querySelectorAll('.stage');
        const label = document.getElementById('stageLabel');
        let timer = null;

        function show(n) {
            stages.forEach(g => g.classList.toggle('on', +g.dataset.stage <= n));
            svg.classList.toggle('past-1', n >= 2);
            steps.forEach(s => {
                const k = +s.dataset.stage;
                s.classList.toggle('active', k === n);
                s.classList.toggle('done', k < n);
                s.setAttribute('aria-selected', String(k === n));
            });
            label.textContent = `· stage ${n} of 4`;
        }

        function play() {
            clearTimeout(timer);
            stages.forEach(g => g.classList.remove('on'));
            let n = 0;
            (function next() {
                n++;
                show(n);
                if (n < 4) timer = setTimeout(next, 1900);
            })();
        }

        steps.forEach(s => s.addEventListener('click', () => { clearTimeout(timer); show(+s.dataset.stage); }));
        document.getElementById('anatomyReplay').addEventListener('click', play);

        if (reduceMotion || !('IntersectionObserver' in window)) {
            show(4);
        } else {
            const io = new IntersectionObserver(([e]) => {
                if (e.isIntersecting) { io.disconnect(); play(); }
            }, { threshold: 0.35 });
            io.observe(svg);
        }
    }

    /* ---------------------------------------------------------------
       3 · Rally mini-game
       --------------------------------------------------------------- */
    const court = document.getElementById('rallyCanvas');
    if (court) {
        const g = court.getContext('2d');
        const countEl = document.getElementById('rallyCount');
        const bestEl = document.getElementById('rallyBest');
        const msgEl = document.getElementById('rallyMsg');
        let W = 0, H = 0, floor = 0, netX = 0, netTop = 0;
        let best = +(storage.get('rallyBest') || 0);
        let shuttle, rally = 0, state = 'ready', visible = false, rafId = null;
        const trail = [];
        bestEl.textContent = best;

        function resize() {
            const r = court.getBoundingClientRect();
            if (!r.width) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = r.width; H = r.height;
            court.width = Math.round(W * dpr); court.height = Math.round(H * dpr);
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            floor = H - 26; netX = W / 2; netTop = floor - Math.min(110, H * 0.38);
            if (state !== 'play') reset();
            draw();
        }

        function reset() {
            shuttle = { x: W * 0.22, y: floor - H * 0.45, vx: 0, vy: 0, ang: Math.PI / 2 };
            trail.length = 0;
        }

        function hit(px, py) {
            if (state === 'over') { state = 'ready'; rally = 0; countEl.textContent = 0; reset(); }
            const reach = Math.max(70, W * 0.08);
            if (Math.hypot(px - shuttle.x, py - shuttle.y) > reach) {
                if (state === 'ready') msgEl.textContent = 'Tap right on the shuttle!';
                return;
            }
            state = 'play';
            const toRight = shuttle.x < netX;
            const scale = H / 320;
            shuttle.vy = -(8.4 + Math.random() * 2.2) * Math.sqrt(scale);
            shuttle.vx = (toRight ? 1 : -1) * (W / 160 + Math.random() * W / 320);
            rally++;
            countEl.textContent = rally;
            msgEl.textContent = rally < 5 ? 'Nice — keep it going!' : rally < 12 ? 'What a rally!' : 'Unstoppable 🔥';
            if (rally > best) { best = rally; bestEl.textContent = best; storage.set('rallyBest', best); }
        }

        court.addEventListener('pointerdown', e => {
            const r = court.getBoundingClientRect();
            hit(e.clientX - r.left, e.clientY - r.top);
            if (!rafId) loop();
        });

        function physics() {
            const scale = H / 320;
            shuttle.vy += 0.26 * scale;           // gravity
            shuttle.vx *= 0.993;                  // feathers create drag
            shuttle.vy = Math.min(shuttle.vy, 5.2 * Math.sqrt(scale)); // terminal velocity
            const prevX = shuttle.x;
            shuttle.x += shuttle.vx; shuttle.y += shuttle.vy;

            // Net: a shuttle crossing below the tape bounces back
            if ((prevX - netX) * (shuttle.x - netX) < 0 && shuttle.y > netTop) {
                shuttle.x = prevX; shuttle.vx *= -0.35;
            }
            if (shuttle.x < 12 || shuttle.x > W - 12) { shuttle.vx *= -0.6; shuttle.x = Math.max(12, Math.min(W - 12, shuttle.x)); }

            shuttle.ang = Math.atan2(shuttle.vy, shuttle.vx);
            trail.push({ x: shuttle.x, y: shuttle.y });
            if (trail.length > 18) trail.shift();

            if (shuttle.y >= floor - 6) {
                shuttle.y = floor - 6;
                state = 'over';
                msgEl.textContent = rally ? `Rally of ${rally}! Tap to play again` : 'Missed it — tap to try again';
            }
        }

        function drawShuttle(x, y, ang) {
            g.save();
            g.translate(x, y);
            g.rotate(ang - Math.PI / 2);          // cork leads in the direction of travel
            g.strokeStyle = '#2b2a2e'; g.lineWidth = 1.4; g.fillStyle = '#fffdf8';
            g.beginPath();                         // feather skirt
            g.moveTo(-6, -2); g.lineTo(-15, -30); g.quadraticCurveTo(0, -35, 15, -30); g.lineTo(6, -2); g.closePath();
            g.fill(); g.stroke();
            g.beginPath(); g.moveTo(-3, -3); g.lineTo(-6, -30); g.moveTo(3, -3); g.lineTo(6, -30); g.moveTo(0, -3); g.lineTo(0, -31); g.stroke();
            g.beginPath(); g.ellipse(0, -16, 10.5, 2.4, 0, 0, Math.PI * 2); g.stroke();
            g.fillStyle = '#e8dcc0';               // cork
            g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill(); g.stroke();
            g.restore();
        }

        function draw() {
            if (!W) return;
            g.clearRect(0, 0, W, H);

            // Court: floor line, service marks, net with mesh
            g.strokeStyle = 'rgba(40, 34, 25, 0.35)'; g.lineWidth = 2;
            g.beginPath(); g.moveTo(16, floor); g.lineTo(W - 16, floor); g.stroke();
            g.setLineDash([6, 8]); g.lineWidth = 1.2;
            [0.25, 0.75].forEach(f => { g.beginPath(); g.moveTo(W * f, floor - 4); g.lineTo(W * f, floor + 8); g.stroke(); });
            g.setLineDash([]);
            g.strokeStyle = 'rgba(40, 34, 25, 0.18)'; g.lineWidth = 1;
            for (let y = netTop + 8; y < floor; y += 9) { g.beginPath(); g.moveTo(netX - 4, y); g.lineTo(netX + 4, y); g.stroke(); }
            g.strokeStyle = '#2b2a2e'; g.lineWidth = 2.5;
            g.beginPath(); g.moveTo(netX, netTop); g.lineTo(netX, floor); g.stroke();
            g.fillStyle = '#fffdf8'; g.fillRect(netX - 6, netTop - 3, 12, 6);
            g.strokeRect(netX - 6, netTop - 3, 12, 6);

            // Pencil-like motion trail
            trail.forEach((p, i) => {
                g.fillStyle = `rgba(43, 42, 46, ${(i / trail.length) * 0.25})`;
                g.beginPath(); g.arc(p.x, p.y, 1.6, 0, Math.PI * 2); g.fill();
            });

            // Soft shadow on the floor
            const h = Math.max(0, Math.min(1, (floor - shuttle.y) / (H * 0.8)));
            g.fillStyle = `rgba(40, 34, 25, ${0.18 * (1 - h)})`;
            g.beginPath(); g.ellipse(shuttle.x, floor + 2, 14 * (1 - h * 0.6), 3, 0, 0, Math.PI * 2); g.fill();

            // Idle bob while waiting to serve
            const bob = state === 'ready' ? Math.sin(Date.now() / 300) * 5 : 0;
            drawShuttle(shuttle.x, shuttle.y + bob, state === 'ready' ? Math.PI / 2 : shuttle.ang);

            if (state === 'ready') {
                g.font = '22px Caveat, cursive';
                g.fillStyle = 'rgba(14, 159, 90, 0.9)';
                // Put the hint on whichever side has room
                if (shuttle.x > 110) g.fillText('tap me →', shuttle.x - 100, shuttle.y + 8 + bob);
                else g.fillText('← tap me', shuttle.x + 24, shuttle.y + 8 + bob);
            }
        }

        function loop() {
            rafId = null;
            if (state === 'play') physics();
            draw();
            if (visible && (state !== 'over' || trail.length)) rafId = requestAnimationFrame(loop);
            if (state === 'over') trail.shift();
        }

        new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible && !rafId) loop();
        }).observe(court);
        new ResizeObserver(resize).observe(court);
        resize();
    }
})();
