import { render, screen, fireEvent } from "@testing-library/react";
import ThemeButton from "./ThemeButton";

test("à noite, o botão oferece o modo dia, e clicar chama a troca", () => {
  const onToggle = vi.fn();
  render(<ThemeButton theme="night" onToggle={onToggle} />);
  fireEvent.click(screen.getByRole("button", { name: "Day mode" }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("no dia, o botão oferece o modo noite", () => {
  render(<ThemeButton theme="day" onToggle={() => {}} />);
  expect(screen.getByRole("button", { name: "Night mode" })).toBeInTheDocument();
});
