// The Projects page pixel scene (drawn by BuilderGrid.astro): training a model.
//
// The scene, left to right: an office chair at a desk with a monitor, keyboard and the mug, a
// comically huge GPU on the floor, a window with the moon, and the same coffee corner as the first
// scene, with a "MORE COMING SOON" banner on the wall over the desk and the GPU. The builder types away while the coffee brews, code filling the screen, then hits enter:
// the GPU's lights come on and its three fans spin up while a training run fills the screen. He
// takes his mug to the coffee maker and fills it from the pot, comes back, and drinks it watching
// the run finish. The fans spin down, he sets the mug back on the desk and starts typing again.
//
// The builder, the coffee corner and the helpers live in sceneKit.ts, shared with the house scene
// parked in sandbox/builderScene.ts.
// Everything is a pure function of time, so the component just calls drawScene() every frame.

import {
	ARMS as CORE_ARMS,
	MUG_H,
	POT_LEVELS,
	POURED,
	SHADES as CORE_SHADES,
	SPARK,
	TABLE_W,
	Timeline,
	WALK_SPEED,
	art as parseArt,
	coffeeSpots,
	drawBuilder,
	drawCoffeeCorner,
	drawRestingMug,
	drinkUp,
	hash,
	holding,
	makeCoffee,
	poseAt,
	stamper,
	tableMugAt,
	textBoard,
	wrapTime,
	type Arm,
	type Put,
	type Segment,
} from "./sceneKit";

const SHADES: Record<string, number> = {
	...CORE_SHADES,
	Y: 0.1, // screen
	V: 0.5, // keyboard
	v: 0.7, // keyboard, lit keys
	R: 0.36, // chair
	r: 0.5, // chair seat, catching the light
	w: 0.24, // chair base and wheels
	j: 0.3, // window frame
	M: 0.5, // moon
	m: 0.36, // moon, inner edge
	b: 0.2, // banner
	Q: 0.95, // banner lettering
	N: 0.6, // nails it hangs from
};
const art = (rows: string[], top = 0) => parseArt(rows, top, SHADES);
const FLOOR = 0.28;
const SEAM = 0.14; // floorboard seams under the floor line
const SCREEN_TEXT = [0.6, 0.85]; // code, and the brighter start of each line
const SCREEN_UI = 0.8; // progress bar, loss curve, check mark
const LED_OFF = 0.22;
const LED_ON = 0.75;

// Typing, and the deliberate press of enter
const ARMS: Record<string, Arm> = {
	...CORE_ARMS,
	type1: { art: art([".......aAA......", "......aAAAA.....", "......aAAAAASS..", "...........SSS.."], 11) },
	type2: { art: art([".......aAA......", "......aAAAAASS..", "......aAAA.SSS.."], 11) },
};

// Desk: lit top, legs at both ends, a drawer block under the monitor
const DESK_W = 36;
const DESK_H = 9;
const DESK = art([
	"+".repeat(DESK_W),
	"#".repeat(DESK_W),
	...[0, 1, 2, 3, 4].map((y) => ".##" + ".".repeat(DESK_W - 15) + (y % 2 ? "KkkkkkkkK" : "KKKKKKKKK") + "##."),
	".##" + ".".repeat(DESK_W - 6) + "##.",
	".##" + ".".repeat(DESK_W - 6) + "##.",
]);
// Monitor, front view: bezel, dark screen (content drawn over it), neck and foot
const MONITOR_W = 20;
const MONITOR_H = 14;
const SCREEN: [number, number, number, number] = [1, 1, 18, 10]; // x, y, w, h inside the monitor
const MONITOR = art(["k".repeat(MONITOR_W), ...Array<string>(10).fill("k" + "Y".repeat(18) + "o"), "K".repeat(MONITOR_W), "........KKKK........", "......KKKKKKKK......"]);
const KEYBOARD = art(["vVvVvVv"]);
const KEYBOARD_W = 7;
// Office chair, side view facing right: backrest behind him, seat, gas lift, star base on wheels
const CHAIR = art(["RR..........", "RR..........", "RR..........", "RR..........", "RR..........", "RR..........", "RRrrrrrrr...", ".RRRRRRRR...", ".....w......", ".....w......", "..wwwwwww...", "..w.....w..."]);
const CHAIR_H = 12;
// Window on the back wall with the moon in it
const WINDOW = art([
	"jjjjjjjjjjjjjjjjjjj",
	"j........j........j",
	"j........j...MMM..j",
	"j........j..MMm...j",
	"j........j.MMm....j",
	"j........j.MMm....j",
	"j........j.MMm....j",
	"j........j..MMm...j",
	"jjjjjjjjjjjjjjMMMjj",
	"j........j........j",
	"j........j........j",
	"j........j........j",
	"j........j........j",
	"j........j........j",
	"jjjjjjjjjjjjjjjjjjj",
]);
const WINDOW_W = 19;

// Banner over the desk and the GPU, in the same style as the first scene's sign, hung by short
// strings from two nails
const BANNER_TEXT = ["MORE COMING SOON"];
const BANNER_BOARD = textBoard(BANNER_TEXT, "b", "Q");
const BANNER_W = BANNER_BOARD[0].length;
const BANNER_STRINGS = [0, 1].map((y) => Array.from({ length: BANNER_W }, (_, x) => (x === 4 || x === BANNER_W - 5 ? (y === 0 ? "N" : "j") : ".")));
const BANNER = art([...BANNER_STRINGS, ...BANNER_BOARD].map((row) => row.join("")));

// The GPU: a shroud with three fan openings, an LED strip along the top, the PCIe fingers along
// the bottom and the I/O bracket on the left. Fans are drawn each frame at their current angle.
const GPU_W = 50;
const GPU_H = 19;
const FANS = [11, 26, 41]; // fan centers across the card
const FAN_Y = 8;
const FAN_R = 6.5;
const FAN_MAX = 15; // full speed, radians per second
const SPIN_UP = 1.6; // seconds
const SPIN_DOWN = 2.2;

// ---------------------------------------------------------------------------------------------
// Choreography
// ---------------------------------------------------------------------------------------------
type Layout = {
	width: number;
	ground: number;
	sitX: number; // builder box left when he sits at the desk
	deskX: number;
	gpuX: number;
	tableX: number;
	window: number | null;
	loop: number;
	segments: Segment[];
	typeEnd: number; // he types until here,
	enter: number; // hits enter here,
	boot: number; // and the GPU comes on here;
	done: number; // the run finishes here and the fans spin down
	brewEnd: number; // the pot fills from the start of the loop until here
	pourEnd: number; // and is empty from here to the end of the loop
	mugOnTable: [number, number]; // the mug waits on the table between these times, else on the desk
};
export type { Layout };

// Smallest area the scene fits in, in art px. Below that the card draws it at half size; the
// page's container query (projects.astro) switches the card's height at the same width.
export const MIN_WIDTH = 136;
export const MIN_HEIGHT = 46;

// Code on the screen: [indent, length] per line, typed out a character at a time
const CODE: [number, number][] = [[0, 9], [2, 12], [2, 7], [4, 10], [4, 6], [2, 11], [0, 5], [2, 13], [4, 8], [2, 6]];
const TYPE_RATE = 16; // characters per second

export function layoutScene(width: number, height: number): Layout {
	const ground = height - 5;
	const sitX = width >= 220 ? 12 : 3;
	const deskX = sitX + 7; // knees under the desk, hands on the keyboard
	const gpuX = deskX + DESK_W + (width >= 220 ? 10 : 4);
	const margin = Math.round(Math.min(18, Math.max(4, (width - MIN_WIDTH) * 0.12 + 6)));
	const { pourReach } = coffeeSpots(0);
	// Coffee table near the right edge; on narrow cards it closes in on the GPU, and he pours
	// standing in front of the GPU
	const tableX = Math.max(gpuX + GPU_W + 2, width - TABLE_W - margin);
	const { atMug } = coffeeSpots(tableX);
	const open = [gpuX + GPU_W + 6, tableX - pourReach - 4]; // floor he only walks across
	const window = open[1] - open[0] >= WINDOW_W + 6 ? Math.round((open[0] + open[1] - WINDOW_W) / 2) : null;

	const tl = new Timeline();
	const sitting = (dur: number, arm: string, extra?: Parameters<Timeline["sit"]>[4]) => tl.sit(dur, sitX, 1, arm, extra);

	// Type out the program, then hit enter
	const typeTime = CODE.reduce((n, [, len]) => n + len, 0) / TYPE_RATE;
	sitting(typeTime, "type1", (u, p) => {
		p.arm = Math.floor(u * 9 + hash(Math.floor(u * 9)) * 1.5) % 2 ? "type2" : "type1";
	});
	const typeEnd = tl.t;
	sitting(0.25, "hold");
	const enter = tl.t;
	sitting(0.2, "type1");
	const boot = tl.t;
	// Watch the GPU spin up, then go get coffee while it trains
	sitting(1.6, "down");
	sitting(0.3, "reachHigh");
	sitting(0.15, "reachHigh", holding("mug", { heldLift: 1 }));
	tl.stand(0.2, sitX, 1, "hold", holding("mug"));
	const brewEnd = tl.t;
	tl.walk(sitX, atMug, () => "hold", WALK_SPEED, holding("mug"));
	const coffee = makeCoffee(tl, tableX);
	tl.stand(0.15, atMug, -1, "hold", holding("mug", POURED));
	tl.walk(atMug, sitX, () => "hold", WALK_SPEED, holding("mug", POURED));
	tl.stand(0.15, sitX, 1, "hold", holding("mug", POURED));
	// Drink it watching the run finish, then set the mug down and get back to it
	drinkUp(tl, sitX, 1);
	const done = tl.t - 1.6;
	sitting(0.25, "reachHigh", holding("mug"));
	sitting(0.3, "down");

	return {
		width,
		ground,
		sitX,
		deskX,
		gpuX,
		tableX,
		window,
		loop: tl.t,
		segments: tl.segments,
		typeEnd,
		enter,
		boot,
		done,
		brewEnd,
		pourEnd: coffee.pourEnd,
		mugOnTable: [coffee.onTable, coffee.offTable],
	};
}

// How far the fans have turned by t: up to speed after boot, full speed, then winding down
function fanAngle(layout: Layout, t: number) {
	const up = Math.min(Math.max(t - layout.boot, 0), SPIN_UP);
	let angle = (FAN_MAX * up * up) / (2 * SPIN_UP);
	angle += FAN_MAX * Math.max(0, Math.min(t, layout.done) - layout.boot - SPIN_UP);
	const down = Math.min(Math.max(t - layout.done, 0), SPIN_DOWN);
	angle += FAN_MAX * (down - (down * down) / (2 * SPIN_DOWN));
	return angle;
}
function fanSpeed(layout: Layout, t: number) {
	if (t < layout.boot) return 0;
	if (t < layout.boot + SPIN_UP) return (FAN_MAX * (t - layout.boot)) / SPIN_UP;
	if (t < layout.done) return FAN_MAX;
	return Math.max(0, FAN_MAX * (1 - (t - layout.done) / SPIN_DOWN));
}

// Draw the scene at `time` (seconds; loops). put(x, y, shade) paints one art pixel, and later
// calls cover earlier ones.
export function drawScene(layout: Layout, time: number, put: Put) {
	const t = wrapTime(layout.loop, time);
	// Unless the timeline says otherwise, the pot fills while he codes, stays full until he pours it,
	// then sits empty
	const p = poseAt(layout.segments, t, { pot: t < layout.pourEnd ? POT_LEVELS * Math.min(1, t / layout.brewEnd) : 0 });
	const { ground, width, sitX, deskX, gpuX, tableX } = layout;
	const stamp = stamper(put);

	// Floor, with a seam every few boards
	for (let x = 0; x < width; x++) {
		put(x, ground, FLOOR);
		if (x % 12 === 0) put(x, ground + 2, SEAM);
	}
	if (layout.window !== null) stamp(WINDOW, layout.window, 5);
	stamp(BANNER, Math.round((deskX + gpuX + GPU_W - BANNER_W) / 2), 2);

	// Desk with the monitor and keyboard, the chair behind him
	stamp(CHAIR, sitX, ground - CHAIR_H);
	const deskTop = ground - DESK_H;
	stamp(DESK, deskX, deskTop);
	stamp(KEYBOARD, sitX + 8, deskTop - 1);
	if (t >= layout.enter && t < layout.enter + 0.15) for (const [dx, dy] of [[KEYBOARD_W, -2], [KEYBOARD_W + 1, -1], [KEYBOARD_W - 2, -3]]) put(sitX + 8 + dx, deskTop + dy, SPARK);
	const monX = deskX + DESK_W - MONITOR_W - 1;
	const monY = deskTop - MONITOR_H;
	stamp(MONITOR, monX, monY);
	drawScreen(put, layout, t, monX + SCREEN[0], monY + SCREEN[1]);

	drawGpu(put, layout, t, gpuX, ground - GPU_H);
	// Power cable from the GPU's bracket along the floor to the desk
	for (let x = deskX + DESK_W - 2; x < gpuX; x++) put(x, ground - 1, SHADES.w);

	// The coffee corner, and the mug waiting on the table or the desk, unless he has it
	drawCoffeeCorner(put, tableX, ground, t < layout.brewEnd, p, t);
	const onTable = t >= layout.mugOnTable[0] && t < layout.mugOnTable[1];
	const onDesk: [number, number] = [sitX + 15, deskTop - MUG_H];
	if (p.held !== "mug") drawRestingMug(put, onTable ? tableMugAt(tableX, ground) : onDesk, p, t);

	drawBuilder(put, p, ground, ARMS, tableMugAt(tableX, ground), t);
}

// What's on the screen: code being typed, then a training run (loss curve and progress bar), then
// a check mark once it's done
function drawScreen(put: Put, layout: Layout, t: number, x0: number, y0: number) {
	const [, , w, h] = SCREEN;
	if (t < layout.boot) {
		// Code, typed out line by line; once the screen is full it scrolls
		let chars = Math.floor(Math.min(t, layout.typeEnd) * TYPE_RATE);
		const lines: [number, number][] = [];
		for (const [indent, len] of CODE) {
			if (chars <= 0) break;
			lines.push([indent, Math.min(len, chars)]);
			chars -= len;
		}
		const shown = lines.slice(-5);
		shown.forEach(([indent, len], i) => {
			for (let k = 0; k < len; k++) put(x0 + 1 + indent + k, y0 + 1 + i * 2, SCREEN_TEXT[k < 3 ? 1 : 0]);
		});
		// Blinking cursor after the last character
		const last = shown[shown.length - 1] ?? [0, 0];
		if (t % 0.8 < 0.45) put(x0 + 1 + last[0] + last[1], y0 + 1 + Math.max(0, shown.length - 1) * 2, SCREEN_TEXT[1]);
		return;
	}
	// Training: a loss curve drawn as it falls, and a progress bar along the bottom
	const progress = Math.min(1, (t - layout.boot) / (layout.done - layout.boot));
	const span = w - 4;
	for (let k = 0; k <= Math.floor(span * progress); k++) {
		const loss = Math.exp((-3.2 * k) / span);
		put(x0 + 2 + k, y0 + 1 + Math.round((1 - loss) * (h - 5)), SCREEN_UI);
	}
	for (let k = 0; k < span; k++) {
		put(x0 + 2 + k, y0 + h - 2, k < Math.round(span * progress) ? SCREEN_UI : SCREEN_TEXT[0] * 0.5);
	}
	// Done: a check mark in the corner
	if (t >= layout.done) {
		const cx = x0 + w - 6;
		const cy = y0 + 2;
		for (const [dx, dy] of [[0, 2], [1, 3], [2, 2], [3, 1], [4, 0]]) put(cx + dx, cy + dy, SCREEN_UI);
	}
}

// The GPU at (x0, y0), its fans at their current angle; blurred into a disc at full speed, with
// the LED strip lit and warm air rising off it while it runs
function drawGpu(put: Put, layout: Layout, t: number, x0: number, y0: number) {
	const running = t >= layout.boot && t < layout.done + SPIN_DOWN * 0.6;
	const speed = fanSpeed(layout, t);
	const angle = fanAngle(layout, t);
	const blur = Math.min(1, Math.max(0, (speed / FAN_MAX - 0.45) / 0.45)) * 0.85;
	for (let y = 0; y < GPU_H; y++) {
		for (let x = 0; x < GPU_W; x++) {
			let v = 0;
			if (y === 0) {
				// LED strip, with a glint sweeping along it while it runs
				if (x >= 3 && x < GPU_W - 2) v = running ? (Math.sin(x * 0.45 - t * 6) > 0.7 ? 1 : LED_ON) : LED_OFF;
			} else if (y === GPU_H - 1) {
				if (x >= 6 && x < 32 && x % 2 === 0) v = 0.62; // PCIe fingers
			} else if (y === GPU_H - 2) {
				if (x >= 1) v = 0.3;
			} else if (x <= 1) {
				v = y % 3 === 0 ? 0.2 : 0.55; // I/O bracket with ports
			} else {
				v = y === 1 ? 0.62 : x === GPU_W - 1 ? 0.3 : 0.44;
				for (const cx of FANS) {
					const dx = x - cx;
					const dy = y - FAN_Y;
					const d = Math.hypot(dx, dy);
					if (d >= FAN_R + 1) continue;
					if (d >= FAN_R) v = 0.14; // the groove around the fan
					else if (d < 1.6) v = 0.8; // hub
					else {
						const blade = Math.cos((Math.atan2(dy, dx) - angle - d * 0.16) * 4) > 0.45 ? 0.56 : 0.22; // four swept blades
						v = blade * (1 - blur) + 0.36 * blur;
					}
				}
			}
			if (v) put(x0 + x, y0 + y, v);
		}
	}
	put(x0 + GPU_W - 4, y0 + GPU_H - 4, running ? 1 : 0.3); // power light
	// Warm air rising off the card at full tilt
	if (speed > FAN_MAX * 0.7) {
		for (const cx of FANS) {
			for (let j = 0; j < 5; j++) {
				const phase = j - t * 6 + cx;
				if (((Math.floor(phase) % 3) + 3) % 3 === 0) continue;
				put(x0 + cx + Math.round(Math.sin(phase * 0.8) * 0.8), y0 - 2 - j, 0.22 * (1 - j / 5));
			}
		}
	}
}

// A moment to show when the scene can't move (reduced motion): hard at work, the GPU at full tilt
export const stillTime = (layout: Layout) => layout.boot + SPIN_UP + 0.1;
