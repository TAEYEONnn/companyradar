import type { Company } from "@/lib/types";

export interface MigrationDuplicate {
  local: Company;
  remote: Company;
  reason: "name" | "domain" | "jobPostUrl";
}

export interface MigrationPlan {
  uniqueLocalCompanies: Company[];
  duplicates: MigrationDuplicate[];
}

export function planCompanyMigration(
  localCompanies: Company[],
  remoteCompanies: Company[],
): MigrationPlan {
  const uniqueLocalCompanies: Company[] = [];
  const duplicates: MigrationDuplicate[] = [];

  localCompanies.forEach((local) => {
    const duplicate = findDuplicate(local, remoteCompanies);
    if (duplicate) {
      duplicates.push({ local, ...duplicate });
      return;
    }
    uniqueLocalCompanies.push(local);
  });

  return { uniqueLocalCompanies, duplicates };
}

function findDuplicate(
  local: Company,
  remoteCompanies: Company[],
): Omit<MigrationDuplicate, "local"> | null {
  const localName = normalizeCompanyName(local.name);
  const localDomain = getDomain(local.homepageUrl);
  const localJobUrl = normalizeUrl(local.jobPostUrl);

  for (const remote of remoteCompanies) {
    if (localName && localName === normalizeCompanyName(remote.name)) {
      return { remote, reason: "name" };
    }

    if (localDomain && localDomain === getDomain(remote.homepageUrl)) {
      return { remote, reason: "domain" };
    }

    if (localJobUrl && localJobUrl === normalizeUrl(remote.jobPostUrl)) {
      return { remote, reason: "jobPostUrl" };
    }
  }

  return null;
}

function normalizeCompanyName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s().,·•|\\_-]+/g, "")
    .replace(/\//g, "");
}

function getDomain(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}
