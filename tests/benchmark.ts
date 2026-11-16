declare const Bun: { version: string };
declare const process: { memoryUsage(): { heapUsed: number; rss: number } };
import { Simulation, isRoad, type Kind } from "../src/simulation";
// Headless measurement only; browser FPS and input latency require the main UI build.
// 50 populated corridors: 50,000 roads + 50,000 operating buildings, then joined by a spine.
const kinds: Kind[] = [
  "farm",
  "well",
  "wind",
  "market",
  "home",
  "home",
  "forest",
  "mine",
  "materials",
  "workshop",
  "storage",
  "school",
  "clinic",
  "recycle",
  "park",
  "power",
];
function scenario() {
  const s = new Simulation(2048, 42, true);
  for (let row = 0; row < 50; row++) {
    const y = 4 + row * 4;
    for (let x = 2; x < 1002; x++) {
      for (const [kind, by] of [
        ["road", y],
        [kinds[(x - 2) % kinds.length], y - 1],
      ] as [Kind, number][]) {
        const error = s.command({ type: "build", kind, x, y: by });
        if (error) throw Error(error);
      }
      const b = s.cells.get((y - 1) * s.size + x)!;
      if (b.kind === "home") b.people = 1;
    }
  }
  return s;
}
const start = performance.now(),
  s = scenario(),
  setupMs = performance.now() - start;
function measure(label: string, expectedNets: number) {
  s.networks();
  const networkCount = new Set(
    [...s.buildings.values()].filter((b) => isRoad(b.kind)).map((b) => b.net),
  ).size;
  if (networkCount !== expectedNets)
    throw Error("Unexpected network count: " + networkCount);
  const times: number[] = [];
  for (let round = 0; round < 20; round++) {
    const t = performance.now();
    s.step(10);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      label,
      buildings: s.buildings.size,
      people: s.summary.people,
      supply: s.summary.supply,
      networkCount,
      samples: times.length,
      roundP95Ms: times[Math.ceil(times.length * 0.95) - 1],
      roundMaxMs: times[times.length - 1],
      roundMedianMs: times[Math.floor(times.length / 2)],
      tick: s.tick,
    }),
  );
  if (s.summary.people === 0) throw Error("Benchmark has no surviving load");
}
console.log(
  JSON.stringify({
    runtime: Bun.version,
    size: s.size,
    setupMs,
    target:
      "100ms per tick / 1000ms per economic round; measurements are headless, not browser FPS",
  }),
);
measure("separate corridors", 50);
for (let y = 4; y <= 200; y++) {
  const error = s.command({ type: "build", kind: "road", x: 1, y });
  if (error) throw Error(error);
}
// Remove local water in alternate corridors: their surviving residents now require spine imports.
for (const b of [...s.buildings.values()])
  if (b.kind === "well" && Math.floor((b.y - 3) / 4) % 2 === 1) {
    s.command({ type: "demolish", x: b.x, y: b.y });
    const error = s.command({ type: "build", kind: "home", x: b.x, y: b.y });
    if (error) throw Error(error);
  }
measure("connected spine with imported water", 1);
const importedWaterResidents = [...s.buildings.values()]
  .filter((b) => b.kind === "home" && Math.floor((b.y - 3) / 4) % 2 === 1)
  .reduce((n, b) => n + b.people, 0);
if (importedWaterResidents === 0)
  throw Error("Spine carries no proven residential load");
console.log(JSON.stringify({ importedWaterResidents }));
const save = s.snapshot(),
  t = performance.now(),
  loaded = Simulation.load(save);
console.log(
  JSON.stringify({
    loadMs: performance.now() - t,
    buildings: loaded.buildings.size,
    heapMiB: process.memoryUsage().heapUsed / 1048576,
    rssMiB: process.memoryUsage().rss / 1048576,
  }),
);
