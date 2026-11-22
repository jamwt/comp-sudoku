import { getServiceToken, getServiceUrl } from "convex/server";
import { ConvexError } from "convex/values";
import { NICKNAME } from "../gameConfig";

export type ModerationResult = {
  allowed: boolean;
  scores: {
    profanityOrSlur: number;
    sexualOrAbusive: number;
  };
};

export type JevModerationDeps = {
  getToken: () => Promise<string>;
  getBaseUrl: () => Promise<string>;
  fetchFn: typeof fetch;
  threshold?: number;
  timeoutMs?: number;
  model?: string;
};

type JevDecisionResponse = {
  answers?: {
    profanity_or_slur?: { type?: unknown; noul?: unknown };
    sexual_or_abusive?: { type?: unknown; noul?: unknown };
  };
};

function readNoulScore(entry: { type?: unknown; noul?: unknown } | undefined): number {
  if (!entry || entry.type !== "noul" || typeof entry.noul !== "number") {
    throw new Error("Missing or invalid noul score in Jev response");
  }
  if (!Number.isFinite(entry.noul) || entry.noul < 0 || entry.noul > 1) {
    throw new Error(`Out-of-range noul score: ${entry.noul}`);
  }
  return entry.noul;
}

const DEFAULT_DEPS: JevModerationDeps = {
  getToken: () => getServiceToken("ai-gateway"),
  getBaseUrl: () => getServiceUrl("ai-gateway"),
  fetchFn: fetch,
};

/**
 * Evaluates a candidate nickname with Jev on Convex AI Gateway (`/alpha/decisions`).
 * Fails closed with a user-facing ConvexError if the gateway is unreachable or
 * returns a malformed payload.
 */
export async function moderateNicknameWithJev(
  nickname: string,
  deps: JevModerationDeps = DEFAULT_DEPS,
): Promise<ModerationResult> {
  const threshold = deps.threshold ?? NICKNAME.moderationRejectThreshold;
  const timeoutMs = deps.timeoutMs ?? NICKNAME.moderationTimeoutMs;
  const model = deps.model ?? NICKNAME.moderationModel;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const [baseUrl, token] = await Promise.all([
      deps.getBaseUrl(),
      deps.getToken(),
    ]);

    const response = await deps.fetchFn(
      `${baseUrl.replace(/\/$/, "")}/alpha/decisions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          state: {
            candidate_nickname: nickname,
            context:
              "Public competitive Sudoku player handle displayed on leaderboards and live matches.",
          },
          questions: {
            profanity_or_slur: {
              type: "noul",
              instructions:
                "Does candidate_nickname contain profanity, obscenity, slurs, or hate speech, including leetspeak, digit substitutions, or concatenated words?",
              criteria: {
                true: "Contains profanity, slurs, hate speech, or clear obfuscated/leetspeak variants (such as f4ck, sh1t, b1tch, or slurs).",
                false:
                  "Benign everyday word, name, gaming handle, or innocuous alphanumeric string.",
              },
            },
            sexual_or_abusive: {
              type: "noul",
              instructions:
                "Does candidate_nickname contain sexually explicit content, graphic violence, self-harm references, or abusive harassment?",
              criteria: {
                true: "Sexually explicit, violent, self-harm, or abusive/harassing handle, including leetspeak or concatenated words.",
                false: "Benign, family-friendly gaming handle.",
              },
            },
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        `Jev moderation request failed (${response.status}): ${detail.slice(0, 300)}`,
      );
      throw new ConvexError(
        "Couldn't verify that nickname right now. Please try again in a moment.",
      );
    }

    const body = (await response.json()) as JevDecisionResponse;
    const profanityOrSlur = readNoulScore(body.answers?.profanity_or_slur);
    const sexualOrAbusive = readNoulScore(body.answers?.sexual_or_abusive);

    return {
      allowed: profanityOrSlur < threshold && sexualOrAbusive < threshold,
      scores: { profanityOrSlur, sexualOrAbusive },
    };
  } catch (err) {
    if (err instanceof ConvexError) throw err;
    console.error("Jev moderation error:", err);
    throw new ConvexError(
      "Couldn't verify that nickname right now. Please try again in a moment.",
    );
  } finally {
    clearTimeout(timer);
  }
}
