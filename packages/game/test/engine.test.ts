import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  chooseCategory,
  createGame,
  MAX_ROLLS_PER_TURN,
  normaliseName,
  resetGame,
  roll,
  setPlayerCount,
  setPlayerName,
  setReady,
  toggleHold,
  type ActionResult,
  type GameState,
} from "../src";

function ok(result: ActionResult): GameState {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.state;
}

function startedGame(names: string[]): GameState {
  let state = createGame(names.length, names);
  names.forEach((_, seat) => {
    state = ok(setReady(state, seat, true));
  });
  return state;
}

describe("setup", () => {
  it("starts only when every seat has a name and is ready", () => {
    let state = createGame(3, ["Anna", "Ben", ""]);
    state = ok(setReady(state, 0, true));
    state = ok(setReady(state, 1, true));
    state = ok(setReady(state, 2, true));
    expect(state.phase).toBe("setup");
    state = ok(setPlayerName(state, 2, "  Carl  "));
    expect(state.playerNames[2]).toBe("Carl");
    expect(state.ready[2]).toBe(false);
    state = ok(setReady(state, 2, true));
    expect(state.phase).toBe("playing");
    expect(state.currentPlayer).toBe(0);
    expect(state.rollsLeft).toBe(MAX_ROLLS_PER_TURN);
  });

  it("clamps the player count to 2..6 and resizes all per-player arrays", () => {
    const state = ok(setPlayerCount(createGame(2, ["Anna", "Ben"]), 9));
    expect(state.playerNames).toEqual(["Anna", "Ben", "", "", "", ""]);
    expect(state.scoreSheets).toHaveLength(6);
    expect(state.usedCategories).toHaveLength(6);
    expect(ok(setPlayerCount(state, 1)).playerNames).toEqual(["Anna", "Ben"]);
  });

  it("does not share sheet objects between players", () => {
    const state = createGame(4);
    expect(new Set(state.scoreSheets).size).toBe(4);
    expect(new Set(state.usedCategories).size).toBe(4);
  });

  it("normalises names", () => {
    expect(normaliseName("  Oma   Erika ")).toBe("Oma Erika");
    expect(normaliseName("x".repeat(80))).toHaveLength(40);
    expect(normaliseName(undefined)).toBe("");
  });
});

describe("turns", () => {
  it("requires a roll before holding or scoring", () => {
    const state = startedGame(["Anna", "Ben"]);
    expect(toggleHold(state, 0, 0)).toEqual({ ok: false, error: expect.stringContaining("Erst würfeln") });
    expect(chooseCategory(state, 0, "chance")).toEqual({ ok: false, error: expect.stringContaining("Erst würfeln") });
  });

  it("only lets the current player act", () => {
    const state = startedGame(["Anna", "Ben"]);
    expect(roll(state, 1).ok).toBe(false);
    expect(roll(state, 0).ok).toBe(true);
  });

  it("keeps held dice and allows exactly three rolls", () => {
    let state = startedGame(["Anna", "Ben"]);
    state = ok(roll(state, 0, () => 0)); // all ones
    state = ok(toggleHold(state, 0, 2));
    state = ok(roll(state, 0, () => 0.99)); // all sixes except the held die
    expect(state.dice).toEqual([6, 6, 1, 6, 6]);
    state = ok(roll(state, 0));
    expect(state.rollsLeft).toBe(0);
    expect(roll(state, 0).ok).toBe(false);
  });

  it("rejects invalid dice indexes and categories", () => {
    const state = ok(roll(startedGame(["Anna", "Ben"]), 0));
    for (const index of [-1, 5, 1.5, NaN]) expect(toggleHold(state, 0, index).ok).toBe(false);
    for (const category of ["bogus", "__proto__", undefined, 3]) expect(chooseCategory(state, 0, category).ok).toBe(false);
  });

  it("scores, blocks reuse and passes the turn", () => {
    let state = ok(roll(startedGame(["Anna", "Ben", "Carl"]), 0, () => 0.5)); // all fours
    state = ok(chooseCategory(state, 0, "fours"));
    expect(state.scoreSheets[0].fours).toBe(20);
    expect(state.currentPlayer).toBe(1);
    expect(state.rollsLeft).toBe(MAX_ROLLS_PER_TURN);
    expect(state.held).toEqual([false, false, false, false, false]);
    state = ok(roll(state, 1));
    state = ok(chooseCategory(state, 1, "chance"));
    state = ok(roll(state, 2));
    state = ok(chooseCategory(state, 2, "chance"));
    expect(state.currentPlayer).toBe(0);
    state = ok(roll(state, 0));
    expect(chooseCategory(state, 0, "fours").ok).toBe(false);
  });

  it("never mutates the input state", () => {
    const state = startedGame(["Anna", "Ben"]);
    const snapshot = JSON.stringify(state);
    ok(chooseCategory(ok(roll(state, 0)), 0, "chance"));
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("a full game", () => {
  it("finishes after every player filled all 13 categories", () => {
    let state = startedGame(["Anna", "Ben", "Carl", "Dora", "Emil", "Fritz"]);
    for (const category of CATEGORIES) {
      for (let seat = 0; seat < 6; seat += 1) {
        expect(state.phase).toBe("playing");
        state = ok(roll(state, seat));
        state = ok(chooseCategory(state, seat, category));
      }
    }
    expect(state.phase).toBe("finished");
    expect(state.gameOver).toBe(true);
    expect(roll(state, 0).ok).toBe(false);

    const rematch = resetGame(state);
    expect(rematch.phase).toBe("setup");
    expect(rematch.playerNames).toEqual(state.playerNames);
    expect(rematch.scoreSheets.every((sheet) => Object.keys(sheet).length === 0)).toBe(true);
  });
});
