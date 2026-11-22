import { describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { moderateNicknameWithJev } from "./jevModeration";

function makeDeps(response: Response | (() => Promise<Response>)) {
  const fetchFn = vi.fn(async () =>
    typeof response === "function" ? await response() : response,
  ) as unknown as typeof fetch;
  return {
    getToken: vi.fn(async () => "svc-token-123"),
    getBaseUrl: vi.fn(async () => "https://ai-gateway.convex.dev"),
    fetchFn,
  };
}

describe("moderateNicknameWithJev", () => {
  test("calls /alpha/decisions with bearer token and allows benign handles", async () => {
    const deps = makeDeps(
      new Response(
        JSON.stringify({
          id: "dec-1",
          model: "typesafe/jev-1.14",
          answers: {
            profanity_or_slur: { type: "noul", noul: 0.02 },
            sexual_or_abusive: { type: "noul", noul: 0.01 },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await moderateNicknameWithJev("sudokupop", deps);
    expect(result).toEqual({
      allowed: true,
      scores: { profanityOrSlur: 0.02, sexualOrAbusive: 0.01 },
    });

    expect(deps.fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = (deps.fetchFn as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ai-gateway.convex.dev/alpha/decisions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer svc-token-123",
    );
    const payload = JSON.parse(String(init.body));
    expect(payload.model).toBe("typesafe/jev-1.14");
    expect(payload.state.candidate_nickname).toBe("sudokupop");
    expect(payload.questions.profanity_or_slur.type).toBe("noul");
    expect(payload.questions.sexual_or_abusive.type).toBe("noul");
  });

  test("rejects when either moderation score meets or exceeds threshold", async () => {
    const deps = makeDeps(
      new Response(
        JSON.stringify({
          answers: {
            profanity_or_slur: { type: "noul", noul: 0.91 },
            sexual_or_abusive: { type: "noul", noul: 0.05 },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await moderateNicknameWithJev("f4ckyou99", deps);
    expect(result.allowed).toBe(false);
    expect(result.scores.profanityOrSlur).toBe(0.91);
  });

  test("fails closed with ConvexError on gateway HTTP errors or malformed payloads", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const httpErrDeps = makeDeps(new Response("upstream error", { status: 502 }));
      await expect(
        moderateNicknameWithJev("sudokupop", httpErrDeps),
      ).rejects.toThrow(ConvexError);

      const badShapeDeps = makeDeps(
        new Response(JSON.stringify({ answers: {} }), { status: 200 }),
      );
      await expect(
        moderateNicknameWithJev("sudokupop", badShapeDeps),
      ).rejects.toThrow(ConvexError);

      const networkErrDeps = makeDeps(async () => {
        throw new Error("socket hang up");
      });
      await expect(
        moderateNicknameWithJev("sudokupop", networkErrDeps),
      ).rejects.toThrow(ConvexError);
    } finally {
      errSpy.mockRestore();
    }
  });
});
