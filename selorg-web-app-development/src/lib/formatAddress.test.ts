import { describe, expect, it } from "vitest";
import {
  addressesLookSame,
  formatAddress,
  formatAddressArea,
  formatAddressLine,
} from "./formatAddress";

describe("formatAddress", () => {
  it("dedupes fat line1 that already embeds area/city/pin", () => {
    const full = formatAddress({
      line1:
        "No.a, Lattice Bridge Road, Adyar, Chennai, Tamil Nadu, Bharathi Nagar, 62a Lattice Bridge Road, Chennai, Tamil Nadu - 600020",
      line2: "Bharathi Nagar, Adyar",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600020",
    });
    expect(full.toLowerCase().split("chennai").length - 1).toBe(1);
    expect(full.toLowerCase().split("tamil nadu").length - 1).toBe(1);
    expect(full).toContain("600020");
    expect(full.toLowerCase()).toContain("adyar");
  });

  it("builds line/area without repeating city", () => {
    const parts = {
      line1: "No. A, Lattice Bridge Road",
      line2: "Bharathi Nagar, Adyar",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600020",
    };
    expect(formatAddressLine(parts)).toBe("No. A, Lattice Bridge Road");
    expect(formatAddressArea(parts)).toBe("Bharathi Nagar, Adyar · Chennai, Tamil Nadu · 600020");
  });

  it("keeps Adyar when neighborhood is Venkata Rathinam Nagar", () => {
    const parts = {
      line1: "",
      line2: "Venkata Rathinam Nagar, Adyar",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600020",
    };
    expect(formatAddressArea(parts)).toContain("Adyar");
    expect(formatAddressArea(parts)).toContain("Venkata Rathinam Nagar");
    expect(formatAddress(parts).toLowerCase()).toContain("adyar");
  });

  it("detects duplicate normalized addresses", () => {
    expect(
      addressesLookSame(
        {
          line1: "No. A, Lattice Bridge Road",
          line2: "Adyar",
          city: "Chennai",
          state: "Tamil Nadu",
          pincode: "600020",
        },
        {
          line1: "No. A, Lattice Bridge Road, Adyar, Chennai",
          line2: "Adyar",
          city: "Chennai",
          state: "Tamil Nadu",
          pincode: "600020",
        },
      ),
    ).toBe(true);
  });
});
