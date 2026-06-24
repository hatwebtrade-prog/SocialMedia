import { generateEmail } from "@/lib/email/generate";

export type DepsFactory = () => { __run?: typeof generateEmail } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) { depsFactory = f; }
export function getDepsFactory(): DepsFactory { return depsFactory; }
