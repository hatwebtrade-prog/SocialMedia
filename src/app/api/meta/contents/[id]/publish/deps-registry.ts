import { publishMetaContent } from "@/lib/meta/publish";

export type DepsFactory = () => { __run?: typeof publishMetaContent } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});

export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}

export function getDepsFactory(): DepsFactory {
  return depsFactory;
}
