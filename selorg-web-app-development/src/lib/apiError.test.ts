import { describe, expect, it } from "vitest";
import { formatAuthError } from "./apiError";
import { ApiError } from "@/services/api";

describe("formatAuthError", () => {
  it("maps USER_NOT_FOUND appCode to signup guidance", () => {
    const err = new ApiError(404, "No account found. Please sign up first.", 404, "USER_NOT_FOUND");
    expect(formatAuthError(err, "fallback")).toBe(
      "No account found for this number. Please sign up first.",
    );
  });

  it("uses backend message for unknown app codes", () => {
    const err = new ApiError(400, "phoneNumber must be exactly 10 digits", 400);
    expect(formatAuthError(err, "fallback")).toBe("phoneNumber must be exactly 10 digits");
  });

  it("maps network failures", () => {
    const err = new ApiError(0, "Cannot connect", "NETWORK_ERROR", "NETWORK_ERROR");
    expect(formatAuthError(err, "fallback")).toContain("Cannot reach the server");
  });
});
