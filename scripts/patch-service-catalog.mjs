#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const targetArgs = args.includes("--prod") ? ["--prod"] : [];
const dryRun = args.includes("--dry-run");

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function runConvex(commandArgs, options = {}) {
  return execFileSync("npx", ["convex", ...commandArgs], {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "inherit"],
  });
}

function patchService(service) {
  const next = { ...service };
  const name = normalizeName(service.name);

  if (name === "engine bay cleaning") {
    next.isActive = false;
    next.showOnLandingPage = false;
    next.serviceType = "addon";
    next.bookingRole = "addon";
  }

  if (name === "bike detail") {
    next.isActive = false;
    next.showOnLandingPage = false;
  }

  if (name === "motorcycle basic detail" || name === "motorcycle full detail") {
    next.showOnLandingPage = false;
  }

  if (name.includes("ceramic coating - wheels")) {
    next.name = "Ceramic Coating - Wheels";
    next.serviceType = "standard";
    next.bookingRole = "upgrade";
    next.showOnLandingPage = true;
  }

  if (name.includes("ceramic coating - windows")) {
    next.name = "Ceramic Coating - Windows";
    next.serviceType = "standard";
    next.bookingRole = "upgrade";
    next.showOnLandingPage = true;
  }

  if (name.includes("5-year ceramic + correction")) {
    next.name = "5-Year Ceramic + Correction";
    next.serviceType = "standard";
    next.bookingRole = "upgrade";
    next.showOnLandingPage = true;
  }

  return next;
}

const tmpDir = mkdtempSync(join(tmpdir(), "rivercitymd-service-catalog-"));
const sourcePath = join(tmpDir, "services.json");
const importPath = join(tmpDir, "services.jsonl");

const servicesJson = runConvex([
  "data",
  "services",
  "--format",
  "json",
  "--limit",
  "1000",
  ...targetArgs,
]);
writeFileSync(sourcePath, servicesJson);

const services = JSON.parse(readFileSync(sourcePath, "utf8"));
const patched = services.map(patchService);
const changes = patched
  .map((service, index) => ({ before: services[index], after: service }))
  .filter(({ before, after }) => JSON.stringify(before) !== JSON.stringify(after));

console.log(
  JSON.stringify(
    changes.map(({ before, after }) => ({
      id: before._id,
      before: before.name,
      after: after.name,
      serviceType: after.serviceType,
      bookingRole: after.bookingRole,
      isActive: after.isActive,
      showOnLandingPage: after.showOnLandingPage,
    })),
    null,
    2,
  ),
);

if (dryRun) {
  console.log(`Dry run only. ${changes.length} service document(s) would change.`);
  process.exit(0);
}

writeFileSync(importPath, patched.map((service) => JSON.stringify(service)).join("\n") + "\n");
runConvex([
  "import",
  "--table",
  "services",
  "--replace",
  "--yes",
  ...targetArgs,
  importPath,
], { stdio: "inherit" });
