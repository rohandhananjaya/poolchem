import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return children;
}

function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllTheProviders, ...options }),
  };
}

export * from "@testing-library/react";
export { customRender as render };
