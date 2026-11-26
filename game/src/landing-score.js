// Grades a landing out of 100: sink rate, touchdown zone, centreline, wings level, flare, stopping.
import { findStrip } from './world-layout.js';

export const medalFor = (score) => (score >= 85 ? 'gold' : score >= 65 ? 'silver' : score >= 40 ? 'bronze' : null);

const SINK = [[0.8, 'Butter', 40], [1.5, 'Smooth', 33], [2.4, 'Firm', 22], [3.4, 'Hard', 10], [Infinity, 'Very hard', 0]];
export function sinkRating(vs) {
	const [, label, points] = SINK.find(([limit]) => Math.abs(vs) < limit);
	return { label, points };
}

export function scoreLanding(td, stripId, sign, zone, stoppedOnStrip) {
	if (!td || td.strip !== stripId) return { score: 0, lines: ['Touched down off the strip'], fromThreshold: null };
	const strip = findStrip(stripId), from = sign * td.along + strip.length / 2, sink = sinkRating(td.vs), off = Math.abs(td.across);
	const zp = from < 0 ? 0 : from >= zone[0] && from <= zone[1] ? 25 : from <= zone[1] * 1.6 ? 12 : 0;
	const cp = off < 2 ? 20 : off < 5 ? 14 : off < strip.width / 2 ? 6 : 0, level = Math.abs(td.bank) < 3, flare = td.pitch > 1, style = level * 3 + flare * 2;
	const lines = [
		`${sink.label} touchdown: ${Math.abs(td.vs).toFixed(1)} m/s sink  (+${sink.points})`,
		from < 0 ? `Landed ${Math.round(-from)} m short of the threshold  (+0)` : `${Math.round(from)} m past the threshold${zp === 25 ? ', in the zone' : zp ? ', a little long' : ', far too long'}  (+${zp})`,
		`${off.toFixed(1)} m off the centreline  (+${cp})`,
	];
	if (style) lines.push(`${[level && 'Wings level', flare && 'nose up in the flare'].filter(Boolean).join(' and ')}  (+${style})`);
	lines.push(stoppedOnStrip ? 'Stopped on the strip  (+10)' : 'Did not stop on the strip  (+0)');
	return { score: Math.min(100, Math.round(sink.points + zp + cp + style + (stoppedOnStrip ? 10 : 0))), lines, fromThreshold: from };
}
