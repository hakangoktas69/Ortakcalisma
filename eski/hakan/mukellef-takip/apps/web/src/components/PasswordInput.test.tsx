import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PasswordInput } from "./PasswordInput";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("varsayılan gizli; düğmeyle gösterilir ve tekrar gizlenir", () => {
    render(<PasswordInput aria-label="Şifre" defaultValue="Gizli-2026" />);
    const input = screen.getByLabelText("Şifre") as HTMLInputElement;
    expect(input.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Şifreyi göster" }));
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "Şifreyi gizle" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Şifreyi gizle" }));
    expect(input.type).toBe("password");
  });

  it("düğme formu göndermez", () => {
    let submitted = false;
    render(
      <form onSubmit={() => (submitted = true)}>
        <PasswordInput aria-label="Şifre" />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Şifreyi göster" }));
    expect(submitted).toBe(false);
  });
});
