import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
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

describe("fit tracker migration", () => {
  it("keeps fit data user-owned and provides a rollback", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260620_v045_fit_tracker_integration.sql",
      ),
      "utf8",
    );
    const rollback = readFileSync(
      resolve(
        process.cwd(),
        "supabase/rollback/20260620_v045_fit_tracker_integration.rollback.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("alter table public.job_postings enable row level security");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("job_postings_user_canonical_url_idx");
    expect(migration).toContain("on conflict (user_id, canonical_url)");
    expect(migration).toContain("save_fit_result");
    expect(migration).not.toContain("resume_text");
    expect(migration).not.toContain("job_text");
    expect(rollback).toContain("drop table if exists public.job_postings");
    expect(rollback).toContain("drop table if exists public.candidate_profiles");
  });
});
