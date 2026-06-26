declare module "pdf-parse" {
  const pdf: (b: Buffer) => Promise<{ text: string }>;
  export default pdf;
}
