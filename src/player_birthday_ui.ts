import app from "./player_save_fix";

// Compatibility boundary for the Players feature chain.
// Birthday form handling now lives in player_save_fix.ts, so this module no
// longer decorates HTML. Keeping the boundary for one deploy lets us remove
// the old layer without changing the upstream navigation/runtime wiring.
export default app;
