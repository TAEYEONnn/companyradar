import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, "src");
const conflictMarker = /^(<<<<<<<|=======|>>>>>>>)(?: .*)?$/m;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(path);
    }

    return [".ts", ".tsx", ".css"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("repository integrity", () => {
  it("does not contain unresolved Git conflict markers", () => {
    const files = [join(projectRoot, "README.md"), ...collectSourceFiles(sourceRoot)];
    const conflictedFiles = files.filter((file) =>
      conflictMarker.test(readFileSync(file, "utf8")),
    );

    expect(conflictedFiles).toEqual([]);
  });
});
