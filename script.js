
const canvas = document.getElementById("flowerCanvas");
const ctx = canvas.getContext("2d");

const W = 720;
const H = 1280;
const FPS = 60;

const T_STEM = 4;
const T_B0 = 5;
const T_B1 = 15;

const BG = "#04020a";


function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    canvas.width = Math.round(screenW * dpr);
    canvas.height = Math.round(screenH * dpr);

    const scale = Math.min(
        screenW / W,
        screenH / H
    );

    const offsetX = (screenW - W * scale) / 2;
    const offsetY = (screenH - H * scale) / 2;

    ctx.setTransform(
        dpr * scale, 0,
        0, dpr * scale,
        dpr * offsetX,
        dpr * offsetY
    );
}

resizeCanvas();

window.addEventListener("resize", resizeCanvas);


let startTime = performance.now();
let paused = false;
let elapsed = 0;

// ---------- MATHEMATICS ----------

function smooth(x) {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function randomSeed(seed) {
    return function () {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const rng = randomSeed(11);

function rand(a, b) {
    return a + rng() * (b - a);
}

function midrib(L, a0, curl, K = 40) {
    const r = [];
    const h = [];
    let rx = 0, hy = 0;

    for (let i = 0; i <= K; i++) {
        const u = i / K;
        const angle = a0 + curl * Math.pow(u, 1.6);

        if (i > 0) {
            rx += Math.sin(angle) * L / K;
            hy += Math.cos(angle) * L / K;
        }

        r.push(rx);
        h.push(hy);
    }

    return { r, h };
}

function point(x, y, color, size = 2) {
    ctx.fillStyle = color;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
}

// ---------- FLOWER SETTINGS ----------

const gx = 360;
const gy = 1050;
const HS = 380;

const petals = [];

for (let k = 0; k < 6; k++) {
    const outer = k % 2 === 0;
    const particles = [];

    for (let i = 0; i < 2300; i++) {
        const u = Math.pow(rng(), 0.85);
        const v = rand(-1, 1);

        const profile = Math.pow(
            Math.sin(Math.PI * Math.pow(u, 0.7)), 0.9
        );

        let red = lerp(205, 255, u);
        let green = lerp(40, 195, u);
        let blue = lerp(125, 228, u);

        if (Math.abs(v) < 0.07 && u < 0.55) {
            red = 235;
            green = 225;
            blue = 150;
        } else if (
            rng() < 0.10 &&
            u < 0.6 &&
            Math.abs(v) < 0.75
        ) {
            red = 140;
            green = 15;
            blue = 80;
        }

        const variation = rand(0.82, 1.17);

        particles.push({
            u, v, profile,
            color: [
                red * variation,
                green * variation,
                blue * variation
            ]
        });
    }

    petals.push({
        phi: k * Math.PI / 3 + 8 * Math.PI / 180,
        L: outer ? 300 : 280,
        W: outer ? 64 : 72,
        ac: outer ? 0.10 : 0.05,
        ao: outer ? 1.05 : 0.82,
        curl: outer ? 0.95 : 0.75,
        particles
    });
}

// ---------- STEM PARTICLES ----------

const stemParticles = [];

for (let i = 0; i < 3200; i++) {
    const s = rng();

    stemParticles.push({
        s,
        dx: rand(-1, 1) * 3.2 * (1 - 0.5 * s),
        color: [
            lerp(40, 120, s),
            lerp(150, 215, s),
            lerp(95, 120, s)
        ]
    });
}

// ---------- LEAVES ----------

const leaves = [];

const leafSettings = [
    [0.10, 190, 1],
    [0.24, 175, -1],
    [0.40, 150, 1],
    [0.56, 120, -1]
];

for (const [s0, L, side] of leafSettings) {
    const particles = [];

    for (let i = 0; i < 900; i++) {
        const u = Math.pow(rng(), 0.9);
        const v = rand(-1, 1);

        const profile = Math.pow(
            Math.sin(Math.PI * Math.pow(u, 0.8)), 0.8
        );

        const variation = rand(0.8, 1.2);

        particles.push({
            u, v, profile,
            color: [
                lerp(40, 140, u) * variation,
                lerp(160, 235, u) * variation,
                lerp(100, 140, u) * variation
            ]
        });
    }

    leaves.push({ s0, L, side, particles });
}

// ---------- SOIL ----------

const soil = [];

for (let i = 0; i < 5000; i++) {
    const dx = rand(-340, 340);
    const mound = (1 - (dx / 340) ** 2) * 55;

    soil.push({
        x: gx + dx,
        y: gy - mound * Math.sqrt(rng()) + rand(-1.5, 1.5),
        color: [
            rand(70, 140) * 0.8,
            rand(55, 100) * 0.8,
            rand(80, 120) * 0.8
        ]
    });
}

// ---------- BACKGROUND PARTICLES ----------

const stars = [];

for (let i = 0; i < 450; i++) {
    stars.push({
        x: rand(0, W),
        y: rand(0, H),
        speed: rand(6, 22),
        phase: rand(0, Math.PI * 2),
        frequency: rand(1, 4)
    });
}

const ringAngles = Array.from(
    { length: 1100 },
    () => rand(0, Math.PI * 2)
);

const floatingParticles = [];

for (let i = 0; i < 140; i++) {
    floatingParticles.push({
        offset: rng(),
        phase: rand(0, Math.PI * 2),
        drift: rand(-80, 80),
        speed: rand(0.05, 0.12)
    });
}

// ---------- STEM POSITION ----------

function stemX(s, t) {
    const sway = 10 * Math.sin(0.9 * t);

    return gx +
        30 * Math.sin(2.2 * s) +
        sway * s * s;
}

function stemY(s) {
    return gy - s * HS;
}

// ---------- DRAWING ----------

function drawBackground(t) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    for (const star of stars) {
        const y = (star.y - t * star.speed + H) % H;

        const twinkle =
            0.35 + 0.65 *
            (Math.sin(t * star.frequency + star.phase) > 0.2 ? 1 : 0);

        point(
            star.x,
            y,
            `rgba(255,200,235,${twinkle * 0.55})`,
            1.5
        );
    }
}

function drawSoil() {
    for (const p of soil) {
        point(
            p.x, p.y,
            `rgb(${p.color.map(Math.round).join(",")})`,
            2
        );
    }
}

function drawStem(t, progress) {
    for (const p of stemParticles) {
        if (p.s > progress) continue;

        const x = stemX(p.s, t) + p.dx;
        const y = stemY(p.s);

        point(
            x, y,
            `rgb(${p.color.map(Math.round).join(",")})`,
            2
        );
    }
}

function drawLeaves(t, progress) {
    for (const leaf of leaves) {
        const growth = Math.max(
            0,
            Math.min(1, (progress - leaf.s0) * 2.5)
        );

        if (growth < 0.01) continue;

        const L = leaf.L * growth;
        const curve = midrib(L, 0.85, 1.1);

        const bx = stemX(leaf.s0, t);
        const by = stemY(leaf.s0);

        const sway = Math.sin(t * 1.2 + leaf.s0 * 5) * 0.03;

        for (const p of leaf.particles) {
            const index = Math.min(
                40,
                Math.floor(p.u * 40)
            );

            const r = lerp(
                curve.r[index],
                curve.r[index + 1],
                p.u * 40 - index
            );

            const h = lerp(
                curve.h[index],
                curve.h[index + 1],
                p.u * 40 - index
            );

            const width = 15 * p.profile * growth;

            const x = bx +
                leaf.side * (r + p.v * width * 0.35) +
                sway * h * leaf.side;

            const y = by - h + p.v * width;

            point(
                x, y,
                `rgb(${p.color.map(Math.round).join(",")})`,
                2
            );
        }
    }
}

function drawPetals(t, opening, bloom) {
    const hx = stemX(1, t);
    const hy = stemY(1);

    const psi = 0.25 + t * 0.22;
    const cp = Math.cos(psi);
    const sp = Math.sin(psi);

    const ct = Math.cos(0.5);
    const st = Math.sin(0.5);

    const sway = Math.sin(t * 0.8) * 0.02;

    for (const petal of petals) {
        const L = petal.L *
            (0.45 + 0.55 * opening) *
            (0.35 + 0.65 * bloom);

        const a0 = lerp(petal.ac, petal.ao, opening);
        const curl = (0.12 + 0.88 * opening) * petal.curl;

        const curve = midrib(L, a0, curl);

        for (const p of petal.particles) {
            if (p.u > bloom) continue;

            const index = Math.min(
                40,
                Math.floor(p.u * 40)
            );

            const f = p.u * 40 - index;

            const r = lerp(
                curve.r[index],
                curve.r[index + 1],
                f
            );

            const h = lerp(
                curve.h[index],
                curve.h[index + 1],
                f
            );

            const width = petal.W *
                (0.55 + 0.45 * opening) *
                p.profile *
                (0.35 + 0.65 * bloom);

            const ph = petal.phi;

            const X = r * Math.cos(ph) -
                p.v * width * Math.sin(ph);

            const Z = r * Math.sin(ph) +
                p.v * width * Math.cos(ph);

            const Y = h +
                p.v * p.v * width *
                (0.30 * (1 - opening) - 0.25 * opening);

            const Xp = X * cp + Z * sp;
            const Zp = -X * sp + Z * cp;

            const sy = Y * ct - Zp * st;

            const shade = 0.55 + 0.45 *
                Math.max(0, Math.min(1, Zp / petal.L * 0.8 + 0.5));

            const tint = (1 - opening) *
                Math.min(p.u * 1.3, 1) * 0.6;

            const red = lerp(p.color[0], 135, tint) * shade;
            const green = lerp(p.color[1], 205, tint) * shade;
            const blue = lerp(p.color[2], 125, tint) * shade;

            const x = hx + Xp + sway * sy;
            const y = hy - sy;

            point(
                x, y,
                `rgb(${Math.round(red)},${Math.round(green)},${Math.round(blue)})`,
                2
            );
        }
    }
}









function drawCenter(t, opening) {
    if (opening < 0.28) return;

    const growth = smooth((opening - 0.28) / 0.4);

    const hx = stemX(1, t);
    const hy = stemY(1);

    const psi = 0.25 + t * 0.22;
    const cp = Math.cos(psi);
    const sp = Math.sin(psi);
    const ct = Math.cos(0.5);
    const st = Math.sin(0.5);

    for (let k = 0; k < 6; k++) {
        const phi = k * Math.PI / 3 + 38 * Math.PI / 180;

        const curve = midrib(
            215 * (0.4 + 0.6 * opening) * growth,
            lerp(0.15, 0.62, opening),
            0.55 * opening
        );

        for (let i = 0; i < 45; i++) {
            const u = rng();
            const index = Math.min(39, Math.floor(u * 40));
            const f = u * 40 - index;

            const r = lerp(curve.r[index], curve.r[index + 1], f);
            const h = lerp(curve.h[index], curve.h[index + 1], f);

            const X = r * Math.cos(phi);
            const Z = r * Math.sin(phi);

            const Xp = X * cp + Z * sp;
            const Zp = -X * sp + Z * cp;

            const sy = h * ct - Zp * st;

            point(
                hx + Xp,
                hy - sy,
                "rgb(245,235,200)",
                3
            );
        }

        
        const tip = curve.r[40];
        const tipH = curve.h[40];

        const tx = tip * Math.cos(phi);
        const tz = tip * Math.sin(phi);

        const txp = tx * cp + tz * sp;
        const tzp = -tx * sp + tz * cp;

        const tsy = tipH * ct - tzp * st;

        for (let i = 0; i < 35; i++) {
            point(
                hx + txp + rand(-5, 5) * 1.6,
                hy - tsy + rand(-5, 5) * 0.7,
                "rgb(255,170,40)",
                3
            );
        }
    }
}



function drawRings(t) {
    const amount = smooth((t - T_B0 + 1.5) / 4) * 0.9;

    if (amount < 0.01) return;

    const hx = stemX(1, t);
    const hy = stemY(1);

    const cx = hx;
    const cy = hy - 90;
    const radius = 300;

    const rotation = t * 0.12;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

   
    for (let i = 0; i < 1100; i++) {
        const a = ringAngles[i] + rotation;

        const x = cx + radius * Math.cos(a);
        const y = cy + radius * Math.sin(a);

        point(
            x, y,
            `rgba(255,190,225,${amount * 0.7})`,
            2
        );
    }

    
    for (let k = 0; k < 6; k++) {
        const ca = rotation * 1.3 + k * Math.PI / 3;

        const ox = cx + radius * Math.cos(ca);
        const oy = cy + radius * Math.sin(ca);

        for (let i = 0; i < 260; i++) {
            const a = (i / 260) * Math.PI * 2 + rotation;

            point(
                ox + radius * 0.5 * Math.cos(a),
                oy + radius * 0.5 * Math.sin(a),
                `rgba(255,170,215,${amount * 0.45})`,
                2
            );
        }
    }

    ctx.restore();
}



function drawFloating(t, opening) {
    if (opening <= 0.6) return;

    const amount = smooth((opening - 0.6) / 0.4);

    const hx = stemX(1, t);
    const hy = stemY(1);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const p of floatingParticles) {
        const q = (t * p.speed + p.offset) % 1;

        const x = hx +
            p.drift * q +
            Math.sin(q * 7 + p.phase) * 25;

        const y = hy - 110 + q * (gy - hy + 90);

        const fade = (1 - q) * amount;

        const color = p.phase > 3.1
            ? `rgba(255,190,80,${fade})`
            : `rgba(255,150,205,${fade})`;

        point(x, y, color, 4);
    }

    ctx.restore();
}



function render(t) {
    const stemProgress = smooth(t / T_STEM);

    const opening = smooth(
        (t - T_B0) / (T_B1 - T_B0)
    );

    const bloom = smooth(
        (t - T_STEM + 0.3) / 1.6
    );

    drawBackground(t);
    drawSoil();
    drawStem(t, stemProgress);
    drawLeaves(t, stemProgress);

    if (bloom > 0.01) {
        drawPetals(t, opening, bloom);
        drawCenter(t, opening);
    }

    drawRings(t);
    drawFloating(t, opening);
}


function animate(now) {
    if (!paused) {
        elapsed = (now - startTime) / 1000;
    }

    render(elapsed);

    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);


window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
        event.preventDefault();

        if (paused) {
            startTime = performance.now() - elapsed * 1000;
        }

        paused = !paused;
    }

    if (event.key.toLowerCase() === "r") {
        elapsed = 0;
        startTime = performance.now();
    }
});
