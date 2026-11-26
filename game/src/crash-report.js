// Turns a crash record into the debrief a pilot can learn from: what hit what, how fast and at
// what attitude, and the chain that led there (a stall, an empty tank, a dead engine).

function attitudeWords(c) {
  if (c.pitch < -25) return 'steep nose-down';
  if (c.pitch < -8) return 'nose-down';
  if (Math.abs(c.bank) > 35) return `${Math.round(Math.abs(c.bank))}° banked`;
  if (c.pitch > 12) return 'tail-low';
  return 'wings-level';
}

/** Headline and detail lines for the crash debrief. */
export function describeCrash(c) {
  const speed = Math.round(c.speedKmh);
  const lines = [];
  let headline = c.cause;
  if (c.stall) {
    headline = `Stalled at ${Math.max(0, Math.round(c.stall.alt))} m, ${attitudeWords(c)} impact at ${speed} km/h`;
    lines.push(`The wing stalled at ${Math.round(c.stall.speedKmh)} km/h airspeed: too slow, or pulled too hard.`);
    lines.push('Recover by easing the stick forward and adding power before the ground arrives.');
  } else if (c.fuelEmpty) {
    headline = `Out of fuel: ${c.cause.toLowerCase()} at ${speed} km/h`;
    lines.push('The tank ran dry. Land at a strip and stop to refuel before the gauge reaches zero.');
  } else if (c.engineOut) {
    headline = `Engine failed: ${c.cause.toLowerCase()} at ${speed} km/h`;
    lines.push('Damage seized the engine. Overspeed, hard landings and high g all add up.');
  } else {
    headline = `${c.cause}, ${attitudeWords(c)} at ${speed} km/h`;
    if (c.kind === 'obstacle') lines.push('Trees and buildings stand 8 to 15 m tall. Keep 50 m above the ground away from strips.');
    else if (c.kind === 'terrain') lines.push('The hills rise fast from the shore. Climb early or turn away from rising ground.');
    else if (c.kind === 'hard') lines.push('Arrive slower and flare: raise the nose gently just above the strip to bleed the sink rate.');
    else if (c.kind === 'water') lines.push('The sea is unforgiving. Keep the strip within gliding range.');
    else if (Math.abs(c.bank) > 20) lines.push('Level the wings before touchdown: a wingtip hangs only 1.5 m above the ground in a bank.');
    else lines.push('Keep the nose up and the wheels first when meeting the ground.');
  }
  lines.unshift(`Impact ${speed} km/h, sink ${Math.abs(c.vs).toFixed(1)} m/s, pitch ${Math.round(c.pitch)}°, bank ${Math.round(c.bank)}°`);
  return { headline, lines };
}
