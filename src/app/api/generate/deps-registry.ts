import { runBrainstorm } from "@/lib/brain/generate";

// Test seam: allows tests to inject a fake runner via deps.__run.
// Lives in a separate module so that `route.ts` does not export non-HTTP symbols,
// which would fail Next.js route type-checking.
export type DepsFactory = () => { __run?: typeof runBrainstorm } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});

export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}

export function getDepsFactory(): DepsFactory {
  return depsFactory;
}
