// Sortie loadout: the fuel and cargo the pilot picks before take-off, and the weight and performance they give.
import { AIRFRAME } from './flight-model.js';

const G = 9.81, RHO = 1.225;

/** The mission's default load: litres of fuel and kilograms of cargo (crates, mail or medical stores). */
export const defaultLoadout = (def) => ({ fuel: def.fuel, cargo: def.cargo ? def.cargo.value : 0 });

/** Step the fuel (by 10 L) and cargo (by the mission's step) within their limits. */
export function adjustLoadout(lo, def, dFuel, dCargo) {
	lo.fuel = Math.max(20, Math.min(AIRFRAME.fuelCapacity, lo.fuel + dFuel * 10));
	if (def.cargo) lo.cargo = Math.max(def.cargo.min, Math.min(def.cargo.max, lo.cargo + dCargo * def.cargo.step));
}

/** All-up mass, clean stall speed, best climb rate at full power, and endurance at cruise power. */
export function performance(lo) {
	const A = AIRFRAME, mass = A.emptyMass + lo.fuel * A.fuelKgPerLitre + lo.cargo, W = mass * G;
	const clMax = A.cl0 + A.clAlpha * A.stallAlpha, V = 30, qS = 0.5 * RHO * V * V * A.wingArea, cl = W / qS;
	const drag = qS * (A.cd0 + A.induced * cl * cl), thrust = A.maxThrust * (1 - V / A.thrustFadeSpeed);
	return {
		mass, stallKmh: Math.sqrt((2 * W) / (RHO * A.wingArea * clMax)) * 3.6, climb: ((thrust - drag) * V) / W,
		enduranceMin: lo.fuel / (0.012 + 0.2 * 0.65) / 60,
	};
}
