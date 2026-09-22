import { describe, expect, it } from "vitest";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { useMounted } from "@/hooks/useMounted";

// Mirrors how Header uses it: an extra child appears in the tree only once mounted.
function Probe() {
  const mounted = useMounted();
  return (
    <div id="shell">
      {mounted ? <span id="extra">extra</span> : null}
      <header id="always">always</header>
    </div>
  );
}

describe("useMounted", () => {
  it("is false on the server and during hydration, true after commit", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Probe />);
    document.body.appendChild(container);
    expect(container.querySelector("#extra")).toBeNull();

    const recoverable: string[] = [];
    await act(async () => {
      hydrateRoot(container, <Probe />, {
        onRecoverableError: (e) => recoverable.push(String(e)),
      });
    });

    expect(recoverable.filter((e) => /hydrat/i.test(e))).toEqual([]);
    expect(container.querySelector("#extra")).not.toBeNull();
  });
});
