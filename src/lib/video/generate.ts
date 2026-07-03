import { buildVideoPrompt, type VideoPromptInput } from "./video-prompt";

export interface VideoGenInput {
  contentId: string;
  slideIndex: number | null;
  prompt?: string;
}
export interface VideoDeps {
  loadStartImage: (contentId: string, slideIndex: number | null) => Promise<Buffer | null>;
  loadReel: (contentId: string) => Promise<VideoPromptInput>;
  callVideo: (imageBuf: Buffer, prompt: string) => Promise<Buffer>;
  persistVideo: (args: { input: VideoGenInput; prompt: string; bytes: Buffer }) => Promise<{ assetId: string }>;
}
export interface VideoGenResult {
  status: "DONE" | "ERROR";
  assetId?: string;
  error?: string;
}

export async function generateVideoAsset(input: VideoGenInput, deps: VideoDeps): Promise<VideoGenResult> {
  try {
    const startImage = await deps.loadStartImage(input.contentId, input.slideIndex);
    if (!startImage) return { status: "ERROR", error: "Genera prima l'immagine di questo contenuto." };
    const prompt = input.prompt?.trim() ? input.prompt.trim() : buildVideoPrompt(await deps.loadReel(input.contentId));
    const bytes = await deps.callVideo(startImage, prompt);
    const { assetId } = await deps.persistVideo({ input, prompt, bytes });
    return { status: "DONE", assetId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
