import { TickClock } from "./tick-clock";
const clock = new TickClock();
import { Simulation, type Command } from "./simulation";
let sim = new Simulation(),
  speed = 0,
  hidden = false;
let view = { x: 0, y: 0, r: 40 };
let last = new Map<number, string>();
function send(reset = false) {
  sim.networks();
  const visible = [...sim.buildings.values()].filter(
    (b) => Math.abs(b.x - view.x) <= view.r && Math.abs(b.y - view.y) <= view.r,
  );
  const updates = visible.filter((b) => last.get(b.id) !== JSON.stringify(b));
  const ids = new Set(visible.map((b) => b.id));
  const removed = [...last.keys()].filter((id) => !ids.has(id));
  last = new Map(visible.map((b) => [b.id, JSON.stringify(b)]));
  postMessage({
    type: "state",
    reset,
    size: sim.size,
    seed: sim.seed,
    sandbox: sim.sandbox,
    tick: sim.tick,
    money: sim.money,
    summary: sim.summary,
    tutorial: sim.tutorial,
    updates,
    removed,
    terrain: reset ? sim.terrain : undefined,
  });
}
self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (["new", "load", "speed", "hidden"].includes(m.type))
    clock.reset(performance.now());
  try {
    switch (m.type) {
      case "new":
        sim = new Simulation(m.size, m.seed, m.sandbox);
        last.clear();
        speed = 1;
        send(true);
        break;
      case "command": {
        const error = sim.command(m.command as Command);
        postMessage({ type: "result", error });
        send();
        break;
      }
      case "view":
        view = m.view;
        send();
        break;
      case "speed":
        speed = m.speed;
        break;
      case "hidden":
        hidden = m.hidden;
        break;
      case "snapshot":
        postMessage({
          type: "snapshot",
          request: m.request,
          save: sim.snapshot(),
        });
        break;
      case "load":
        sim = Simulation.load(m.save);
        last.clear();
        send(true);
        break;
      case "inspect": {
        const b = sim.cells.get(m.y * sim.size + m.x);
        if (b?.reason && sim.tutorial === 4 && !b.ok) sim.tutorial = 5;
        postMessage({ type: "inspect", building: b, x: m.x, y: m.y });
        break;
      }
    }
  } catch (error) {
    postMessage({ type: "error", error: String(error) });
  }
};
function pump() {
  if (speed && !hidden && clock.due(performance.now())) {
    const round = Math.floor(sim.tick / 10);
    sim.step(speed);
    if (Math.floor(sim.tick / 10) > round) send();
  } else if (!speed || hidden) clock.reset(performance.now());
  setTimeout(pump, 10);
}
clock.reset(performance.now());
setTimeout(pump, 10);
