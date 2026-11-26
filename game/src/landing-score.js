// Grades a landing out of 100: sink rate, touchdown zone, centreline, wings level, flare, stopping.
import { findStrip } from './world-layout.js';

export function medalFor(score) {
	return score >= 85 ? 'gold' : score >= 65 ? 'silver' : score >= 40 ? 'bronze' : null;
}

export function sinkRating(vs) {
	const v = Math.abs(vs);
	if (v < 0.8) return { label: 'Butter', points: 40 };
	if (v < 1.5) return { label: 'Smooth', points: 33 };
	if (v < 2.4) return { label: 'Firm', points: 22 };
	if (v < 3.4) return { label: 'Hard', points: 10 };
	return { label: 'Very hard', points: 0 };
}

/**
 * Score a touchdown on strip `stripId` landing in direction `sign` (+1 along the strip heading).
 * `zone` is the [near, far] touchdown band in metres from the threshold.
 */
export function scoreLanding(td, stripId, sign, zone, stoppedOnStrip) {
	const strip = findStrip(stripId);
	const lines = [];
	if (!td || td.strip !== stripId) {
		return { score: 0, medal: null, lines: ['Touched down off the strip'], fromThreshold: null };
	}
	const fromThreshold = sign * td.along + strip.length / 2;
	const sink = sinkRating(td.vs);
	let score = sink.points;
	lines.push(`${sink.label} touchdown: ${Math.abs(td.vs).toFixed(1)} m/s sink  (+${sink.points})`);
	let zp = 0;
	if (fromThreshold < 0) lines.push(`Landed ${Math.round(-fromThreshold)} m short of the threshold  (+0)`);
	else {
		zp = fromThreshold >= zone[0] && fromThreshold <= zone[1] ? 25 : fromThreshold <= zone[1] * 1.6 ? 12 : 0;
		lines.push(`${Math.round(fromThreshold)} m past the threshold${zp === 25 ? ', in the zone' : zp ? ', a little long' : ', far too long'}  (+${zp})`);
	}
	score += zp;
	const off = Math.abs(td.across);
	const cp = off < 2 ? 20 : off < 5 ? 14 : off < strip.width / 2 ? 6 : 0;
	lines.push(`${off.toFixed(1)} m off the centreline  (+${cp})`);
	score += cp;
	const style = (Math.abs(td.bank) < 3 ? 3 : 0) + (td.pitch > 1 ? 2 : 0);
	if (style) lines.push(`${Math.abs(td.bank) < 3 ? 'Wings level' : ''}${style === 5 ? ' and ' : ''}${td.pitch > 1 ? 'nose up in the flare' : ''}  (+${style})`);
	score += style;
	if (stoppedOnStrip) {
		score += 10;
		lines.push('Stopped on the strip  (+10)');
	} else lines.push('Did not stop on the strip  (+0)');
	score = Math.max(0, Math.min(100, Math.round(score)));
	return { score, medal: medalFor(score), lines, fromThreshold };
}
