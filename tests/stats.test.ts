import { describe, expect, it } from "vitest";
import { recordGameResult } from "../lib/stats";

describe("daily game statistics", () => {
  it("counts only the first result on the same UTC date", () => {
    const first = recordGameResult(null, "2026-08-06", "win");
    expect(recordGameResult(first, "2026-08-06", "lose")).toEqual(first);
  });

  it("continues a winning streak on the next natural UTC day", () => {
    const first = recordGameResult(null, "2026-08-06", "win");
    const second = recordGameResult(first, "2026-08-07", "win");
    expect(second).toMatchObject({ streak: 2, maxStreak: 2, played: 2, wins: 2 });
  });

  it("resets after a loss or missed date", () => {
    const first = recordGameResult(null, "2026-08-06", "win");
    const missedDay = recordGameResult(first, "2026-08-08", "win");
    const loss = recordGameResult(missedDay, "2026-08-09", "lose");
    const nextWin = recordGameResult(loss, "2026-08-10", "win");

    expect(missedDay.streak).toBe(1);
    expect(loss.streak).toBe(0);
    expect(nextWin.streak).toBe(1);
    expect(nextWin.maxStreak).toBe(1);
  });
});
