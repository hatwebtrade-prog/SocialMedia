import { generateBlogArticle } from "@/lib/blog/generate";

export type DepsFactory = () => { __run?: typeof generateBlogArticle } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}
export function getDepsFactory(): DepsFactory {
  return depsFactory;
}
