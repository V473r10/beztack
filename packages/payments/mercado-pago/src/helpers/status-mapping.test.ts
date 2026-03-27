import { describe, expect, it } from "vitest";
import { mapMPStatus } from "./status-mapping.js";

describe("mapMPStatus", () => {
  it("maps 'authorized' to 'active'", () => {
    expect(mapMPStatus("authorized")).toBe("active");
  });

  it("maps 'pending' to 'pending'", () => {
    expect(mapMPStatus("pending")).toBe("pending");
  });

  it("maps 'paused' to 'paused'", () => {
    expect(mapMPStatus("paused")).toBe("paused");
  });

  it("maps 'cancelled' to 'canceled'", () => {
    expect(mapMPStatus("cancelled")).toBe("canceled");
  });

  it("maps unknown status to 'canceled'", () => {
    expect(mapMPStatus("something_else")).toBe("canceled");
  });
});
