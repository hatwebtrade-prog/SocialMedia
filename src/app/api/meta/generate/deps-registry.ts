import { generateMetaContent } from "@/lib/meta/generate";

export type DepsFactory = () => { __run?: typeof generateMetaContent } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}
export function getDepsFactory(): DepsFactory {
  return depsFactory;
}
