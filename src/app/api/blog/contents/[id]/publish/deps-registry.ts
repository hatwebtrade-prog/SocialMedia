import { publishBlogContent } from "@/lib/blog/publish";
export type DepsFactory = () => { __run?: typeof publishBlogContent } & Record<string, unknown>;
let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) { depsFactory = f; }
export function getDepsFactory(): DepsFactory { return depsFactory; }
