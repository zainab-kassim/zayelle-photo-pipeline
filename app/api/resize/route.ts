// TODO: Upload endpoint for app/page.tsx — call the resize function from src/resize.ts.
//
// The page POSTs multipart form data with a single field "file" and expects
// JSON back in this shape (or { error: string } with a non-2xx status):
//
// {
//   original: { name: string; bytes: number; width?: number; height?: number },
//   outputs: Array<{
//     name: "large" | "thumb";
//     width: number;
//     height: number;
//     bytes: number;
//     fileName: string;   // e.g. "red-dress-large.webp"
//     dataUrl: string;    // "data:image/webp;base64,..." for preview + download
//   }>,
//   ms: number            // processing time
// }

export const runtime = "nodejs";

export async function POST() {
  return Response.json({ error: "Not implemented yet — see app/api/resize/route.ts" }, { status: 501 });
}
