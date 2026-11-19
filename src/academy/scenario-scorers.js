/**
 * Trusted versioned scenario scorer registry.
 * Empty until Rules / Strategy publish independently checked PlayerView and
 * golden legal-action fixtures. Never register a scorer from UI/user input.
 */
const FIXTURES=Object.freeze({});
export function verifiedScenarioFixture(fixtureId) {
  return Object.prototype.hasOwnProperty.call(FIXTURES,fixtureId)?FIXTURES[fixtureId]:null;
}
export const VERIFIED_SCENARIO_SCORER_COUNT=Object.keys(FIXTURES).length;
