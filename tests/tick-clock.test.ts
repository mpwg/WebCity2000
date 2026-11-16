import { expect, it } from "vitest";
import { TickClock } from "../src/tick-clock";

it("holt lange Runden begrenzt nach und verwirft Hintergrundzeit beim Reset", () => {
  const clock = new TickClock();
  clock.reset(0);
  expect(clock.due(100)).toBe(true);
  expect(clock.due(550)).toBe(true);
  for (let i = 0; i < 3; i++) expect(clock.due(550)).toBe(true);
  expect(clock.due(550)).toBe(false);
  let pulses = 0;
  while (clock.due(100000)) pulses++;
  expect(pulses).toBe(10);
  clock.reset(200000);
  expect(clock.due(200099)).toBe(false);
  expect(clock.due(200100)).toBe(true);
});
