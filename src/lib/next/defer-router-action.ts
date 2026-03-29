import { startTransition } from "react";

export function deferRouterAction(fn: () => void): void {
  startTransition(() => {
    setTimeout(fn, 0);
  });
}
