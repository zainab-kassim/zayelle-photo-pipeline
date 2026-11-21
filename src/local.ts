// Runs the resize function on a photo from samples/ and writes the WebPs to output/.
//
//   npm run local                          # uses samples/red-dress.png
//   npm run local -- samples/another.jpg   # any other photo
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resizeToWebp } from "./resize";

const INPUT_PATH = process.argv[2] ?? "samples/red-dress.png";
const OUTPUT_DIR = "output";

const toKB = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

const main = async () => {
  try {
    // 1. Read the photo from disk into a Buffer
    const input = await readFile(INPUT_PATH);

    // 2. Resize it into both WebP sizes
    const start = performance.now();
    const results = await resizeToWebp(input);
    const ms = Math.round(performance.now() - start);

    // 3. Make sure output/ exists, then save each WebP
    await mkdir(OUTPUT_DIR, { recursive: true });

    const baseName = path.parse(INPUT_PATH).name; // "samples/red-dress.png" -> "red-dress"

    console.log(`\n${path.basename(INPUT_PATH)}  ${toKB(input.length)}  →  ${ms} ms\n`);

    for (const result of results) {
      const outputPath = path.join(OUTPUT_DIR, `${baseName}-${result.name}.webp`);
      await writeFile(outputPath, result.buffer);

      const saved = Math.round((1 - result.bytes / input.length) * 100);
      console.log(
        `  ${result.name.padEnd(6)} ${`${result.width}×${result.height}`.padEnd(10)} ${toKB(result.bytes).padStart(9)}  -${saved}%  → ${outputPath}`,
      );
    }

    console.log();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`\nNo file at ${INPUT_PATH}. Put a photo in samples/ and try again.\n`);
    } else {
      console.error(`\n${error instanceof Error ? error.message : error}\n`);
    }
    process.exit(1);
  }
};

main();
