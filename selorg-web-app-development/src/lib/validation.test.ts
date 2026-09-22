import { describe, expect, it } from "vitest";
import {
  isValidAuthOtp,
  isValidCardNumber,
  isValidCvv,
  isValidEmail,
  isValidExpiry,
  isValidPhone10,
  isValidVpa,
  last10Digits,
} from "./validation";

describe("isValidPhone10", () => {
  it("accepts exactly 10 digits, ignoring non-digit characters", () => {
    expect(isValidPhone10("98765 43210")).toBe(true);
    expect(isValidPhone10("+91 98765 43210")).toBe(false); // 12 digits total
    expect(isValidPhone10("12345")).toBe(false);
  });
});

describe("last10Digits", () => {
  it("strips non-digits and keeps only the last 10", () => {
    expect(last10Digits("+91 98765 43210")).toBe("9876543210");
  });
});

describe("isValidEmail", () => {
  it("validates a plausible email shape", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("isValidVpa", () => {
  it("validates UPI-style ids", () => {
    expect(isValidVpa("name@okbank")).toBe(true);
    expect(isValidVpa("name")).toBe(false);
  });
});

describe("isValidCardNumber / isValidCvv / isValidExpiry", () => {
  it("card number requires at least 16 digits", () => {
    expect(isValidCardNumber("4111 1111 1111 1111")).toBe(true);
    expect(isValidCardNumber("4111 1111")).toBe(false);
  });
  it("cvv requires at least 3 digits", () => {
    expect(isValidCvv("123")).toBe(true);
    expect(isValidCvv("12")).toBe(false);
  });
  it("expiry requires MM/YY shape", () => {
    expect(isValidExpiry("09/28")).toBe(true);
    expect(isValidExpiry("9/28")).toBe(false);
    expect(isValidExpiry("09-28")).toBe(false);
  });
});

describe("isValidAuthOtp", () => {
  it("accepts any code with at least 4 digits (source has no fixed login OTP)", () => {
    expect(isValidAuthOtp("1234")).toBe(true);
    expect(isValidAuthOtp("9999")).toBe(true);
    expect(isValidAuthOtp("123")).toBe(false);
  });
});
