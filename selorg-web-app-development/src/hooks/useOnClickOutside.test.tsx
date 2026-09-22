import { describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { render, fireEvent } from "@testing-library/react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";

function Picker({
  id,
  onOutside,
  ignoreSelector,
}: {
  id: string;
  onOutside: () => void;
  ignoreSelector?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, onOutside, { ignoreSelector });
  return (
    <div ref={ref} data-location-picker data-testid={id}>
      <button type="button">panel action</button>
    </div>
  );
}

describe("useOnClickOutside", () => {
  it("fires for clicks outside the ref", () => {
    const onOutside = vi.fn();
    render(<Picker id="one" onOutside={onOutside} />);
    fireEvent.mouseDown(document.body);
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("does not fire for clicks inside the ref", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(<Picker id="one" onOutside={onOutside} />);
    fireEvent.mouseDown(getByTestId("one").querySelector("button")!);
    expect(onOutside).not.toHaveBeenCalled();
  });

  // Regression: Header mounts a desktop and a compact LocationPicker at once and they
  // share one open flag. Without ignoreSelector the hidden twin closed the panel on
  // mousedown, cancelling the click before any button handler could run.
  it("ignores clicks inside a sibling instance matching ignoreSelector", () => {
    const desktopOutside = vi.fn();
    const mobileOutside = vi.fn();
    const { getByTestId } = render(
      <>
        <Picker
          id="desktop"
          onOutside={desktopOutside}
          ignoreSelector="[data-location-picker]"
        />
        <Picker
          id="mobile"
          onOutside={mobileOutside}
          ignoreSelector="[data-location-picker]"
        />
      </>,
    );

    fireEvent.mouseDown(getByTestId("desktop").querySelector("button")!);
    expect(desktopOutside).not.toHaveBeenCalled();
    expect(mobileOutside).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.body);
    expect(desktopOutside).toHaveBeenCalledTimes(1);
    expect(mobileOutside).toHaveBeenCalledTimes(1);
  });

  it("skips the listener when disabled", () => {
    const onOutside = vi.fn();
    function Disabled() {
      const ref = useRef<HTMLDivElement>(null);
      useOnClickOutside(ref, onOutside, { enabled: false });
      return <div ref={ref} />;
    }
    render(<Disabled />);
    fireEvent.mouseDown(document.body);
    expect(onOutside).not.toHaveBeenCalled();
  });
});
