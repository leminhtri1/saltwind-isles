// Turns a crash record into a debrief: what hit what, how fast, at what attitude, and why.

const ADVICE = {
	obstacle: 'Trees and buildings stand 8 to 15 m tall. Keep 50 m above the ground away from strips.',
	terrain: 'The hills rise fast from the shore. Climb early or turn away from rising ground.',
	hard: 'Arrive slower and flare: raise the nose gently just above the strip to bleed the sink rate.',
	water: 'The sea is unforgiving. Keep the strip within gliding range.',
};

const attitudeWords = (c) => (c.pitch < -25 ? 'steep nose-down' : c.pitch < -8 ? 'nose-down' : Math.abs(c.bank) > 35 ? `${Math.round(Math.abs(c.bank))}° banked` : c.pitch > 12 ? 'tail-low' : 'wings-level');

export function describeCrash(c) {
	const speed = Math.round(c.speedKmh), how = `${c.cause.toLowerCase()} at ${speed} km/h`;
	const [headline, ...why] = c.stall
		? [`Stalled at ${Math.max(0, Math.round(c.stall.alt))} m, ${attitudeWords(c)} impact at ${speed} km/h`, `The wing stalled at ${Math.round(c.stall.speedKmh)} km/h airspeed: too slow, or pulled too hard.`, 'Recover by easing the stick forward and adding power before the ground arrives.']
		: c.fuelEmpty ? [`Out of fuel: ${how}`, 'The tank ran dry. Land at a strip and stop to refuel before the gauge reaches zero.']
		: c.engineOut ? [`Engine failed: ${how}`, 'Damage seized the engine. Overspeed, hard landings and high g all add up.']
		: [`${c.cause}, ${attitudeWords(c)} at ${speed} km/h`, ADVICE[c.kind] || (Math.abs(c.bank) > 20 ? 'Level the wings before touchdown: a wingtip hangs only 1.5 m above the ground in a bank.' : 'Keep the nose up and the wheels first when meeting the ground.')];
	return { headline, lines: [`Impact ${speed} km/h, sink ${Math.abs(c.vs).toFixed(1)} m/s, pitch ${Math.round(c.pitch)}°, bank ${Math.round(c.bank)}°`, ...why] };
}
