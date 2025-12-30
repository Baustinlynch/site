(function () {
    // tiny seeded PRNG (mulberry32)
    function rng(seed) {
        let t = seed >>> 0;
        return () => {
            t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
    }
    function lerp(a, b, t) { return a + (b - a) * t; }

    // Perlin-like gradient noise 
    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function makePerlinNoise2D(seed) {
        const rand = rng(seed);
        const grads = new Map();
        function grad(ix, iy) {
            const key = ix + ',' + iy;
            let v = grads.get(key);
            if (!v) {
                const angle = rand() * Math.PI * 2;
                v = [Math.cos(angle), Math.sin(angle)];
                grads.set(key, v);
            }
            return v;
        }
        return (x, y) => {
            const ix = Math.floor(x), iy = Math.floor(y);
            const fx = x - ix, fy = y - iy;
            const g00 = grad(ix, iy), g10 = grad(ix + 1, iy), g01 = grad(ix, iy + 1), g11 = grad(ix + 1, iy + 1);
            const d00 = (fx) * g00[0] + (fy) * g00[1];
            const d10 = (fx - 1) * g10[0] + (fy) * g10[1];
            const d01 = (fx) * g01[0] + (fy - 1) * g01[1];
            const d11 = (fx - 1) * g11[0] + (fy - 1) * g11[1];
            const ux = fade(fx), uy = fade(fy);
            const a = lerp(d00, d10, ux);
            const b = lerp(d01, d11, ux);
            return lerp(a, b, uy);
        };
    }

    function fractalNoise2D(noiseFn, x, y, octaves = 5, lacunarity = 2, persistence = 0.5) {
        let value = 0, amp = 1, freq = 1, max = 0;
        for (let i = 0; i < octaves; i++) {
            value += noiseFn(x * freq, y * freq) * amp;
            max += amp;
            amp *= persistence;
            freq *= lacunarity;
        }
        return value / max;
    }

    // linear interpolation on cell edges for contour intersection
    function interp(x1,y1,h1,x2,y2,h2,t) {
        const d = h2 - h1;
        const u = Math.abs(d) < 1e-6 ? 0.5 : Math.max(0, Math.min(1, (t - h1) / d));
        return [lerp(x1,x2,u), lerp(y1,y2,u)];
    }

    // per-level marching squares (small switch table)
    function drawLevel(ctx, grid, cols, rows, step, level) {
        ctx.beginPath();
        for (let j=0;j<rows-1;j++) {
            for (let i=0;i<cols-1;i++) {
                const x = i*step, y = j*step;
                const p00 = grid[j*cols + i], p10 = grid[j*cols + i+1], p11 = grid[(j+1)*cols + i+1], p01 = grid[(j+1)*cols + i];
                const tl = p00>=level?1:0, tr = p10>=level?1:0, br = p11>=level?1:0, bl = p01>=level?1:0;
                const code = (tl<<3)|(tr<<2)|(br<<1)|bl;
                if (code===0 || code===15) continue;
                const top = interp(x,y,p00,x+step,y,p10,level);
                const right = interp(x+step,y,p10,x+step,y+step,p11,level);
                const bottom = interp(x,y+step,p01,x+step,y+step,p11,level);
                const left = interp(x,y,p00,x,y+step,p01,level);
                switch (code) {
                    case 1: ctx.moveTo(...left); ctx.lineTo(...bottom); break;
                    case 2: ctx.moveTo(...bottom); ctx.lineTo(...right); break;
                    case 3: ctx.moveTo(...left); ctx.lineTo(...right); break;
                    case 4: ctx.moveTo(...top); ctx.lineTo(...right); break;
                    case 5: ctx.moveTo(...top); ctx.lineTo(...left); ctx.moveTo(...bottom); ctx.lineTo(...right); break;
                    case 6: ctx.moveTo(...top); ctx.lineTo(...bottom); break;
                    case 7: ctx.moveTo(...top); ctx.lineTo(...left); break;
                    case 8: ctx.moveTo(...top); ctx.lineTo(...left); break;
                    case 9: ctx.moveTo(...top); ctx.lineTo(...bottom); break;
                    case 10: ctx.moveTo(...top); ctx.lineTo(...right); ctx.moveTo(...bottom); ctx.lineTo(...left); break;
                    case 11: ctx.moveTo(...top); ctx.lineTo(...right); break;
                    case 12: ctx.moveTo(...left); ctx.lineTo(...right); break;
                    case 13: ctx.moveTo(...bottom); ctx.lineTo(...right); break;
                    case 14: ctx.moveTo(...left); ctx.lineTo(...bottom); break;
                }
            }
        }
        ctx.stroke();
    }

    function drawLineMap(opts={}) {
        // use provided numeric seed; otherwise choose a new random seed each page load
        const seed = (typeof opts.seed === 'number') ? opts.seed : Math.floor(Math.random() * 2 ** 31);
        const contourInterval = opts.contourInterval || 0.05;
        // smaller default step -> higher sampling resolution; can be overridden via opts.step
        const step = Math.max(2, opts.step || 4);
        const color = opts.color || '#8a877a46';
        const lineWidth = opts.lineWidth || 2;
        const octaves = typeof opts.octaves === 'number' ? opts.octaves : 5;
        const scale = typeof opts.scale === 'number' ? opts.scale : 0.0025;
        const lacunarity = typeof opts.lacunarity === 'number' ? opts.lacunarity : 2;
        const persistence = typeof opts.persistence === 'number' ? opts.persistence : 0.5;

        let c = document.getElementById('topo-line-canvas');
        if (!c) {
            c = document.createElement('canvas');
            c.id = 'topo-line-canvas';
            c.style.position = 'fixed';
            c.style.left = '0'; c.style.top = '0';
            c.style.width = '100%'; c.style.height = '100%';
            c.style.zIndex = '-1'; c.style.pointerEvents = 'none';
            document.body.appendChild(c);
        }
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const cssW = Math.floor(window.innerWidth), cssH = Math.floor(window.innerHeight);
        c.width = cssW * dpr; c.height = cssH * dpr;
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.clearRect(0,0,cssW,cssH);

        const perlin = makePerlinNoise2D(seed);
        const cols = Math.ceil(cssW / step) + 1, rows = Math.ceil(cssH / step) + 1;
        const grid = new Float32Array(cols * rows);
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const nx = (i * step) * scale;
                const ny = (j * step) * scale;
                grid[j * cols + i] = fractalNoise2D(perlin, nx, ny, octaves, lacunarity, persistence);
            }
        }

        // normalize
        let min=Infinity,max=-Infinity; for (let v of grid){ if (v<min)min=v; if (v>max)max=v; }
        const rng = (max-min)||1; for (let k=0;k<grid.length;k++) grid[k] = (grid[k]-min)/rng;

        ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = 'round';
        for (let t=0.0; t<=1.0001; t+=contourInterval) drawLevel(ctx, grid, cols, rows, step, t);
    }

    window.initTopoBackground = function (opts) {
        const settings = Object.assign({}, opts);
        drawLineMap(settings);
        const onResize = () => drawLineMap(settings);
        window.addEventListener('resize', onResize);
        return {
            redraw: (o) => { Object.assign(settings, o||{}); drawLineMap(settings); },
            destroy: () => { window.removeEventListener('resize', onResize); const c=document.getElementById('topo-line-canvas'); if (c) c.remove(); }
        };
    };
})();