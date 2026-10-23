// What the Projects page pixel scenes share (coderScene.ts, and the house scene parked in
// sandbox/builderScene.ts): the builder himself, the coffee corner (table, drip coffee maker, pot
// and mug), the pixel font, and the timeline and drawing helpers the scenes are choreographed with.
//
// Everything is in "art pixels" (BuilderGrid.astro scales each one to a block of grid cells), and
// shades are brightness 0-1, like CUP_SHADES in CoffeeCupGrid.astro.

export const SHADES: Record<string, number> = {
	// builder
	C: 0.52, // cap
	c: 0.72, // cap highlight
	B: 0.3, // cap brim
	H: 0.28, // hair
	S: 1, // skin
	s: 0.72, // skin in shadow (ear, jaw)
	E: 0.02, // eyes
	T: 0.62, // shirt
	t: 0.45, // shirt in shadow
	A: 0.86, // near sleeve
	a: 0.7, // near sleeve edge
	L: 0.25, // belt
	P: 0.42, // near leg
	p: 0.3, // far leg
	F: 0.62, // near shoe
	f: 0.45, // far shoe
	// mug
	U: 1, // walls
	u: 0.75, // rim and handle
	i: 0.14, // empty inside (mug and pot)
	q: 0.5, // coffee
	// coffee pot
	g: 0.85, // glass
	G: 0.6, // lid and handle
	// lumber (tables)
	"+": 0.6,
	"#": 0.44,
	// coffee maker
	K: 0.44, // body
	k: 0.62, // highlight
	o: 0.3, // shadow
	n: 0.6, // filter outlet
	x: 0.2, // dark trim
	O: 0.26, // power light
	I: 1, // power light while brewing
	W: 0.2, // water window
	"=": 0.5, // warming plate
};
export const STREAM = [0.62, 0.9]; // alternating, so the coffee looks like it's flowing
export const STEAM = 0.42;
export const SPARK = 1;

// Parsed art: the lit pixels as [x, y, shade]. "." (or any character without a shade) is empty.
export type Art = [number, number, number][];
export const art = (rows: string[], top = 0, shades: Record<string, number> = SHADES): Art => {
	const px: Art = [];
	rows.forEach((row, y) => {
		for (let x = 0; x < row.length; x++) {
			const v = shades[row[x]];
			if (v !== undefined) px.push([x, y + top, v]);
		}
	});
	return px;
};

export type Put = (x: number, y: number, v: number) => void;
// Stamp art at (x, y); mirrorW flips it within that width (the builder's box, or a held thing)
export const stamper =
	(put: Put) =>
	(a: Art, x: number, y: number, mirrorW = 0) => {
		for (const [px, py, v] of a) put(mirrorW ? x + mirrorW - 1 - px : x + px, y + py, v);
	};

// Deterministic "random" in [0, 1), so scattered details stay put from frame to frame
export const hash = (n: number) => {
	const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return s - Math.floor(s);
};

// 3x5 pixel font (M, N and W are wider)
export const FONT: Record<string, string[]> = {
	A: [".#.", "#.#", "###", "#.#", "#.#"],
	B: ["##.", "#.#", "##.", "#.#", "##."],
	C: [".##", "#..", "#..", "#..", ".##"],
	D: ["##.", "#.#", "#.#", "#.#", "##."],
	E: ["###", "#..", "##.", "#..", "###"],
	F: ["###", "#..", "##.", "#..", "#.."],
	G: [".##", "#..", "#.#", "#.#", ".##"],
	H: ["#.#", "#.#", "###", "#.#", "#.#"],
	I: ["###", ".#.", ".#.", ".#.", "###"],
	J: ["..#", "..#", "..#", "#.#", ".#."],
	K: ["#.#", "#.#", "##.", "#.#", "#.#"],
	L: ["#..", "#..", "#..", "#..", "###"],
	M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
	N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
	O: [".#.", "#.#", "#.#", "#.#", ".#."],
	P: ["##.", "#.#", "##.", "#..", "#.."],
	Q: [".#.", "#.#", "#.#", "##.", ".##"],
	R: ["##.", "#.#", "##.", "#.#", "#.#"],
	S: [".##", "#..", ".#.", "..#", "##."],
	T: ["###", ".#.", ".#.", ".#.", ".#."],
	U: ["#.#", "#.#", "#.#", "#.#", "###"],
	V: ["#.#", "#.#", "#.#", "#.#", ".#."],
	W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"],
	X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
	Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
	Z: ["###", "..#", ".#.", "#..", "###"],
	".": [".", ".", ".", ".", "#"],
	"!": ["#", "#", "#", ".", "#"],
	" ": ["..", "..", "..", "..", ".."],
};
export const glyphW = (ch: string) => FONT[ch][0].length;
export const textWidth = (text: string) => [...text].reduce((w, ch) => w + glyphW(ch) + 1, -1);

// A framed board with lines of text centered on it (1px frame and 1px padding), as rows of shade
// characters: "+" for the frame, `fill` for the board, `ink` for the letters
export function textBoard(lines: string[], fill: string, ink: string): string[][] {
	const w = Math.max(...lines.map(textWidth)) + 4;
	const h = lines.length * 6 + 3;
	const grid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (y === 0 || y === h - 1 || x === 0 || x === w - 1 ? "+" : fill)));
	lines.forEach((line, i) => {
		let x = Math.floor((w - textWidth(line)) / 2);
		for (const ch of line) {
			FONT[ch].forEach((row, gy) => [...row].forEach((c, gx) => c === "#" && (grid[2 + i * 6 + gy][x + gx] = ink)));
			x += glyphW(ch) + 1;
		}
	});
	return grid;
}

// ---------------------------------------------------------------------------------------------
// The builder: a 16x24 box, facing right. Facing left mirrors every layer around the box, so arm
// poses that reach past it stay attached to the body.
// ---------------------------------------------------------------------------------------------
export const BOX_W = 16;
export const BOX_H = 24;

const HEAD = [
	"....CCCCCC......",
	"..CCCCCCCCcc....",
	".CCCCCCCCCCcc...",
	".CCCCCCCCCCCcc..",
	".HCCCCCCCBBBBBBB",
	".HHHsSSSSSSSS...",
	".HHssSSSSSSES...",
	".HHssSSSSSSESS..",
	"..HHSSSSSSSSSS..",
	"..HHSSSSSSSSS...",
	"...HsSSSSSSs....",
];
// Eyes shut: blinking, and savoring the coffee
const HEAD_SHUT = HEAD.map((row, y) => (y === 6 ? ".HHssSSSSSSSS..." : y === 7 ? ".HHssSSSSEEESS.." : row));
const TORSO = [
	".....tTTTTT.....",
	"....ttTTTTTT....",
	"....ttTTTTTT....",
	"....ttTTTTTT....",
	"....ttTTTTTT....",
	"....LLLLLLLL....",
];
const LEGS = {
	stand: [
		".....pPPPPPP....",
		"....pPPPPPP.....",
		".....pPPPP......",
		".....pPPPP......",
		".....pPPPP......",
		"....fFFFFFF.....",
		"....fFFFFFFF....",
	],
	// near leg forward
	step1: [
		"....pPPPPPPP....",
		"....ppPPPPPP....",
		"...pppPPPPP.....",
		"...ppp.PPPPP....",
		"..ppp...PPPP....",
		".ffff...FFFFFF..",
		".ffff...FFFFFF..",
	],
	// near leg back
	step2: [
		"....pPPPPPPP....",
		"....PPPPPPpp....",
		"...PPPPPppp.....",
		"...PPPP.pppp....",
		"..PPPP...pppp...",
		".FFFF....fffff..",
		".FFFF....fffff..",
	],
	// sitting: seat at the back, thighs forward to the knee, shins down in front
	sit: [
		"...ppPPPPPPPPP..",
		"...ppPPPPPPPPP..",
		"...........PPP..",
		"...........PPP..",
		"...........PPP..",
		"..........FFFFF.",
		"..........FFFFFF",
	],
};
export type Legs = keyof typeof LEGS;
const LEG_NAMES = Object.keys(LEGS) as Legs[];
const bodies = (head: string[]) => Object.fromEntries(LEG_NAMES.map((k) => [k, art([...head, ...TORSO, ...LEGS[k]])])) as Record<Legs, Art>;
export const BODY = { open: bodies(HEAD), shut: bodies(HEAD_SHUT) };

// Near arm, drawn over the body. `grip` is where a held mug's or pot's handle goes. Scenes add
// their own poses (a hammer swing, typing) to these.
export type Arm = { art: Art; grip?: [number, number] };
export const ARMS = {
	// at rest
	down: { art: art([".......aAA......", "......aAAA......", "......aAAA......", ".......SSS......", ".......SSS......", ".......sSS......"], 11) },
	// reaching for the mug on a table, the pot on the warming plate (or a mug on a desk), and
	// something low (a mug on a stump)
	reach: { art: art([".......aAA.........", "......aAAAAAAA.....", "......aAAAAAAASSS..", ".............SS...."], 11), grip: [16, 13] },
	reachHigh: { art: art([".......aAAAAAASSS..", "......aAAAAAAASS...", "......aAAA........."], 11), grip: [16, 11] },
	reachLow: { art: art([".......aAA.......", "......aAAAA......", "......aAAAAA.....", ".........aAAA....", "...........SSSS..", "...........SS...."], 11), grip: [14, 15] },
	// holding the pot up, clear of the mug (and pouring from it)
	raise: { art: art(["...............SS.", "..............SSS.", "............aAA...", "..........aAAA....", "........aAAA......", ".......aAAA.......", "......aAAA........", "......aAAA........"], 6), grip: [16, 6] },
	// mug at the chest, and up at the mouth
	hold: { art: art([".......aAA......", "......aAAAAASSS.", "......aAAAAASS.."], 11), grip: [14, 12] },
	drink: { art: art(["...........SS...", "..........SSS...", ".........aAA....", "........aAA.....", ".......aAAA.....", "......aAAA......", "......aAAA......"], 8), grip: [13, 8] },
} satisfies Record<string, Arm>;
export const REACH_GRIP = ARMS.reach.grip as [number, number];

// Lines over the cap when the coffee kicks in, relative to the box
const ENERGIZED: [number, number][] = [[4, -4], [8, -4], [12, -4], [5, -3], [8, -3], [11, -3]];

// ---------------------------------------------------------------------------------------------
// The coffee corner
// ---------------------------------------------------------------------------------------------
// A held thing: its art and width, the pixel the hand closes on, and (for the pot) where coffee
// pours out
export type Held = { art: Art; w: number; grip: [number, number]; spout?: [number, number] };

// Mug, handle on the left; level = rows of coffee (0 empty, 4 full)
export const MUG_LEVELS = 4;
export const MUG_W = 7;
export const MUG_H = 6;
export const MUG_INSIDE = 3; // first column inside the mug
export const MUGS: Held[] = Array.from({ length: MUG_LEVELS + 1 }, (_, level) => {
	const inside = (row: number) => (MUG_LEVELS - row < level ? "qqq" : "iii");
	return { art: art(["..UuuuU", "uuU" + inside(1) + "U", "u.U" + inside(2) + "U", "uuU" + inside(3) + "U", "..U" + inside(4) + "U", "...UUU."]), w: MUG_W, grip: [1, 2] };
});

// Coffee pot: glass with a lid, handle on the left, spout on the right; level = rows of coffee
// (0 empty, 5 full). Tipped versions for pouring, the coffee settled at the bottom.
export const POT_LEVELS = 5;
const POT_W = 8;
const POTS: Held[] = Array.from({ length: POT_LEVELS + 1 }, (_, level) => {
	const inside = (row: number, w: number) => (POT_LEVELS + 1 - row <= level ? "q" : "i").repeat(w);
	return {
		art: art(["...GGG..", "..GGGGGg", "GG.g" + inside(2, 2) + "g", "G.g" + inside(3, 3) + "g", "G.g" + inside(4, 3) + "g", "GGg" + inside(5, 3) + "g", "..g" + inside(6, 3) + "g", "...ggg.."]),
		w: POT_W,
		grip: [0, 3],
	};
});
const potTipping = (full: boolean): Held => {
	const rows = ["....GG..", ".GGGGGG.", "G...gqGG", "G.gqqqgg", "GGgqqqg.", ".gqqqqg.", "..gqqg..", "..gggg.."];
	return { art: art(full ? rows : rows.map((row) => row.replaceAll("q", "i"))), w: POT_W, grip: [0, 3] };
};
const POT_TIPPING = [potTipping(false), potTipping(true)];
// Pouring, by rows of coffee left (0-4)
const POT_POURING: Held[] = Array.from({ length: 5 }, (_, level) => {
	const c = (row: number, w: number) => (level > row ? "q" : "i").repeat(w);
	return {
		art: art(["..GG.....", ".GGGGGG..", "G..ggGGGg", "GGg" + c(3, 4) + "gg", ".g" + c(2, 5) + "g.", ".g" + c(1, 4) + "g..", "..g" + c(0, 2) + "g...", "...gg...."]),
		w: 9,
		grip: [0, 3],
		spout: [8, 3],
	};
});

// Table: lit top edge, legs at both ends. Room for the mug, then the coffee maker with space
// between them to slide the pot out.
export const TABLE_W = 32;
export const TABLE_H = 7;
const TABLE = art(["+".repeat(TABLE_W), "#".repeat(TABLE_W), ...Array<string>(TABLE_H - 2).fill(".##" + ".".repeat(TABLE_W - 6) + "##.")]);

// Drip coffee maker, side view: the brew head overhangs the pot, which sits on the warming plate
const MAKER_ROWS = [
	"....kkkkkkkkk.",
	".kkkKKKKKKKKKo",
	"kKKKKKKKKKKKKo",
	".KKKKKKKKKKKKo",
	"..xnnx.KKKKKKo",
	".......KKWWKKo",
	".......KKWWKKo",
	".......KKWWKKo",
	".......KKKKKKo",
	".......KKKKKKo",
	".......KKKKKKo",
	".......KKKOKKo",
	".......KKKKKKo",
	".......KKKKKKo",
	"=======KKKKKKo",
];
const MAKER = { off: art(MAKER_ROWS), brewing: art(MAKER_ROWS.map((row) => row.replace("O", "I"))) };
const MAKER_H = MAKER_ROWS.length;
const MAKER_OFFSET = 16; // maker x relative to the table
const DRIP: [number, number] = [3, 5]; // where the brew drips into the pot, maker coordinates
const POT_AT: [number, number] = [-1, 6]; // pot position on the warming plate, maker coordinates

// Where the builder stands to make coffee at a table at tableX (box left edges), and how far left
// of the table he stands to pour into the mug on it
export function coffeeSpots(tableX: number) {
	const pour = POT_POURING[0];
	const pourReach = ARMS.raise.grip[0] - pour.grip[0] + pour.spout![0] - MUG_INSIDE - 1;
	const makerX = tableX + MAKER_OFFSET;
	const potReach = ARMS.reachHigh.grip[0] - POTS[0].grip[0]; // pot's x relative to the builder when he holds it low
	return {
		pourReach,
		atMug: tableX + MUGS[0].grip[0] - REACH_GRIP[0], // reaching the mug on the table
		atPot: makerX + POT_AT[0] - potReach, // reaching the pot on the warming plate
		atClear: makerX - POT_W - potReach, // pot slid out from under the machine, short of the mug
		atPour: tableX - pourReach,
	};
}

// ---------------------------------------------------------------------------------------------
// Choreography
// ---------------------------------------------------------------------------------------------
export const WALK_SPEED = 40; // art px per second
export const SHUFFLE_SPEED = 30; // the little steps around a table
const STEP_PX = 4; // art px per walk frame
const BLINK_EVERY = 3.7;
const BLINK_TIME = 0.13;

export type Pose = {
	x: number; // builder box left
	lift: number; // px off the ground (a little hop)
	facing: 1 | -1;
	legs: Legs;
	arm: string;
	shut: boolean; // eyes closed
	held: "none" | "mug" | "pot" | "tipping" | "pouring";
	heldLift: number; // px a held thing is raised above where the grip puts it
	mug: number; // coffee in the mug, 0-MUG_LEVELS (fractional while it fills or empties)
	pot: number; // coffee in the pot, 0-POT_LEVELS
	steam: number; // 0-1, off the mug
	energized: boolean;
};
export type Step = (u: number, p: Pose) => void;
export type Segment = { start: number; dur: number; step: Step };

export const holding = (held: Pose["held"], more?: Partial<Pose>): Step => (_, p) => Object.assign(p, { held }, more);
// Facing right while stepping back to the left
export const backward = (more: Partial<Pose>): Step => (_, p) => Object.assign(p, { facing: 1 }, more);

// A scene's timeline: segments laid end to end, each setting the builder's pose for its stretch
export class Timeline {
	segments: Segment[] = [];
	t = 0;
	add(dur: number, step: Step) {
		this.segments.push({ start: this.t, dur, step });
		this.t += dur;
	}
	stand(dur: number, x: number, facing: 1 | -1, arm: string, extra?: Step) {
		this.add(dur, (u, p) => {
			Object.assign(p, { x, facing, arm, legs: "stand" });
			extra?.(u, p);
		});
	}
	sit(dur: number, x: number, facing: 1 | -1, arm: string, extra?: Step) {
		this.add(dur, (u, p) => {
			Object.assign(p, { x, facing, arm, legs: "sit" });
			extra?.(u, p);
		});
	}
	walk(from: number, to: number, arm: (step: number) => string, speed = WALK_SPEED, extra?: Step) {
		const dir = to > from ? 1 : -1;
		this.add(Math.abs(to - from) / speed, (u, p) => {
			const d = u * speed;
			const step = Math.floor(d / STEP_PX) % 4;
			Object.assign(p, { x: Math.round(from + dir * d), facing: dir, legs: (["step1", "stand", "step2", "stand"] as const)[step], arm: arm(step) });
			extra?.(u, p);
		});
	}
}

// The state right after pouring: an empty pot and a full, steaming mug
export const POURED = { pot: 0, mug: MUG_LEVELS, steam: 1 };

// At the table with the empty mug in hand: set it down, slide the pot out from under the machine,
// lift it over the mug and pour, put the pot back the same way, and pick the full mug back up.
// Returns when the mug was on the table, when the pot ran dry, and when the pot was back.
export function makeCoffee(tl: Timeline, tableX: number) {
	const { atMug, atPot, atClear, atPour } = coffeeSpots(tableX);
	tl.stand(0.25, atMug, 1, "reach", holding("mug"));
	const onTable = tl.t;
	tl.stand(0.2, atMug, 1, "down");
	tl.walk(atMug, atPot, () => "down", SHUFFLE_SPEED);

	tl.stand(0.3, atPot, 1, "reachHigh");
	tl.stand(0.15, atPot, 1, "reachHigh", holding("pot", { heldLift: 1 }));
	tl.walk(atPot, atClear, () => "reachHigh", SHUFFLE_SPEED, backward({ held: "pot", heldLift: 1 }));
	tl.stand(0.15, atClear, 1, "raise", holding("pot"));
	tl.walk(atClear, atPour, () => "raise", SHUFFLE_SPEED, backward({ held: "pot" }));
	tl.stand(0.12, atPour, 1, "raise", holding("tipping"));
	const pourTime = 1.5;
	tl.stand(pourTime, atPour, 1, "raise", (u, p) => {
		const k = Math.min(1, u / (pourTime - 0.2));
		Object.assign(p, { held: "pouring", pot: POT_LEVELS * (1 - k), mug: MUG_LEVELS * k, steam: Math.max(0, k * 2 - 1) });
	});
	const pourEnd = tl.t;
	tl.stand(0.12, atPour, 1, "raise", holding("tipping", POURED));

	tl.walk(atPour, atClear, () => "raise", SHUFFLE_SPEED, holding("pot", POURED));
	tl.stand(0.15, atClear, 1, "reachHigh", holding("pot", { ...POURED, heldLift: 1 }));
	tl.walk(atClear, atPot, () => "reachHigh", SHUFFLE_SPEED, holding("pot", { ...POURED, heldLift: 1 }));
	tl.stand(0.15, atPot, 1, "reachHigh", holding("pot", POURED));
	tl.stand(0.15, atPot, 1, "reachHigh", (_, p) => Object.assign(p, POURED));
	const potBack = tl.t;
	tl.walk(atPot, atMug, () => "down", SHUFFLE_SPEED, backward(POURED));

	tl.stand(0.25, atMug, 1, "reach", (_, p) => Object.assign(p, POURED));
	const offTable = tl.t;
	tl.stand(0.2, atMug, 1, "hold", holding("mug", POURED));
	return { onTable, offTable, pourEnd, potBack };
}

// Drink the mug in three sips, sitting at x, looking up between them; then a moment of energy
export function drinkUp(tl: Timeline, x: number, facing: 1 | -1) {
	tl.sit(0.35, x, facing, "hold", holding("mug", POURED));
	const SIPS = 3;
	const level = (sips: number) => MUG_LEVELS * (1 - sips / SIPS);
	const steamAfter = (sips: number) => Math.max(0, 1 - sips / 1.5);
	for (let k = 0; k < SIPS; k++) {
		const sipTime = 0.6;
		tl.sit(sipTime, x, facing, "drink", (u, p) =>
			Object.assign(p, { held: "mug", shut: true, mug: level(k + u / sipTime), heldLift: u < sipTime - 0.1 ? 1 : 0, steam: steamAfter(k + u / sipTime) }),
		);
		tl.sit(k < SIPS - 1 ? 0.7 : 0.4, x, facing, "hold", holding("mug", { mug: level(k + 1), steam: steamAfter(k + 1) }));
	}
	tl.sit(0.7, x, facing, "hold", (u, p) => Object.assign(p, { held: "mug", energized: u < 0.6 }));
}

// The builder's pose at loop time t: the segment's say, over the scene's defaults, plus blinking
export function poseAt(segments: Segment[], t: number, defaults: Partial<Pose>): Pose {
	const p: Pose = {
		x: 0,
		lift: 0,
		facing: 1,
		legs: "stand",
		arm: "down",
		shut: false,
		held: "none",
		heldLift: 0,
		mug: 0,
		pot: 0,
		steam: 0,
		energized: false,
		...defaults,
	};
	const seg = segments.find((s) => t < s.start + s.dur) ?? segments[segments.length - 1];
	seg.step(Math.min(seg.dur, t - seg.start), p);
	if (t % BLINK_EVERY < BLINK_TIME) p.shut = true;
	return p;
}

// ---------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------
// Where the mug sits on the coffee table
export const tableMugAt = (tableX: number, ground: number): [number, number] => [tableX, ground - TABLE_H - MUG_H];

// Steam curling up off a mug at (x, y)
export function drawSteam(put: Put, x: number, y: number, mirrored: boolean, amount: number, t: number) {
	for (let k = 0; k < 2; k++) {
		const col = MUG_INSIDE + k * 2;
		for (let j = 0; j < 6; j++) {
			const phase = j - t * 5 + k * 1.7; // pattern drifts upward
			if (((Math.floor(phase) % 3) + 3) % 3 === 0) continue;
			const sway = Math.round(Math.sin(phase * 0.7 + k * 2) * 0.8);
			put(x + (mirrored ? MUG_W - 1 - col : col) + sway, y - 1 - j, STEAM * amount * (1 - j / 6));
		}
	}
}

// Table and coffee maker (the power light on and coffee dripping while it brews), with the pot on
// the warming plate unless the builder has it
export function drawCoffeeCorner(put: Put, tableX: number, ground: number, brewing: boolean, p: Pose, t: number) {
	const stamp = stamper(put);
	const tableTop = ground - TABLE_H;
	stamp(TABLE, tableX, tableTop);
	const makerX = tableX + MAKER_OFFSET;
	const makerY = tableTop - MAKER_H;
	stamp(brewing ? MAKER.brewing : MAKER.off, makerX, makerY);
	if (brewing && (t * 5) % 1 < 0.6) put(makerX + DRIP[0], makerY + DRIP[1], STREAM[1]);
	if (p.held !== "pot" && p.held !== "tipping" && p.held !== "pouring") stamp(POTS[Math.round(p.pot)].art, makerX + POT_AT[0], makerY + POT_AT[1]);
}

// A mug resting somewhere (not in his hand), steaming if it has fresh coffee
export function drawRestingMug(put: Put, at: [number, number], p: Pose, t: number) {
	stamper(put)(MUGS[Math.round(p.mug)].art, ...at);
	if (p.steam > 0) drawSteam(put, ...at, false, p.steam, t);
}

// The builder: body, then whatever's in his hand (the pot, upright, tipping or pouring into the mug
// waiting at pourInto, or the mug), then the near arm over it, then the energy lines once the coffee
// kicks in. `arms` is the scene's set of arm poses.
export function drawBuilder(put: Put, p: Pose, ground: number, arms: Record<string, Arm>, pourInto: [number, number], t: number) {
	const stamp = stamper(put);
	const bodyY = ground - BOX_H - p.lift;
	const mirror = p.facing < 0;
	stamp((p.shut ? BODY.shut : BODY.open)[p.legs], p.x, bodyY, mirror ? BOX_W : 0);

	const inHand = (h: Held): [number, number] => {
		const [gx, gy] = arms[p.arm].grip ?? REACH_GRIP;
		const hand = mirror ? BOX_W - 1 - gx : gx;
		const grip = mirror ? h.w - 1 - h.grip[0] : h.grip[0];
		return [p.x + hand - grip, bodyY + gy - h.grip[1] - p.heldLift];
	};
	if (p.held === "pot" || p.held === "tipping" || p.held === "pouring") {
		const potLevel = Math.round(p.pot);
		const pot = p.held === "pot" ? POTS[potLevel] : p.held === "tipping" ? POT_TIPPING[potLevel > 0 ? 1 : 0] : POT_POURING[Math.ceil((p.pot / POT_LEVELS) * 4)];
		const [x, y] = inHand(pot);
		stamp(pot.art, x, y, mirror ? pot.w : 0);
		if (pot.spout) {
			const sx = x + (mirror ? pot.w - 1 - pot.spout[0] : pot.spout[0]);
			const surface = pourInto[1] + 1 + MUG_LEVELS - Math.round(p.mug); // first row of coffee (or the mug's floor)
			for (let sy = y + pot.spout[1] + 1; sy < surface; sy++) put(sx, sy, STREAM[(sy + Math.floor(t * 18)) % 2]);
		}
	}
	if (p.held === "mug") {
		const [x, y] = inHand(MUGS[Math.round(p.mug)]);
		stamp(MUGS[Math.round(p.mug)].art, x, y, mirror ? MUG_W : 0);
		if (p.steam > 0) drawSteam(put, x, y, mirror, p.steam, t);
	}
	stamp(arms[p.arm].art, p.x, bodyY, mirror ? BOX_W : 0);
	if (p.energized) for (const [dx, dy] of ENERGIZED) put(p.x + (mirror ? BOX_W - 1 - dx : dx), bodyY + dy, SPARK);
}

export const wrapTime = (loop: number, time: number) => ((time % loop) + loop) % loop;
