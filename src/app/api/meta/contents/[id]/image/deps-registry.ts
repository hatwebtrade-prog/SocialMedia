import { generateImageAsset } from "@/lib/image/generate";

export type DepsFactory = () => { __run?: typeof generateImageAsset } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}
export function getDepsFactory(): DepsFactory {
  return depsFactory;
}
