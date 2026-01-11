#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_OUT = path.resolve(__dirname, "..", "tierlist.json");

function parseArgs(argv) {
  const args = { input: null, out: DEFAULT_OUT, source: "manual" };
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--input" && argv[i + 1]) {
      args.input = argv[i + 1];
      i += 1;
    } else if (value === "--out" && argv[i + 1]) {
      args.out = argv[i + 1];
      i += 1;
    } else if (value === "--source" && argv[i + 1]) {
      args.source = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function readInput(inputPath) {
  if (inputPath) {
    return fs.readFileSync(inputPath, "utf8");
  }
  return fs.readFileSync(0, "utf8");
}

function cleanItem(value) {
  return value
    .replace(/^[\\s*\\-\\d.)]+/, "")
    .replace(/\\s+/g, " ")
    .trim();
}

function splitItems(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => cleanItem(item))
    .filter(Boolean);
}

function parseTierLines(text) {
  const tiers = { S: [], A: [], B: [], C: [], D: [] };
  let current = null;

  text.split(/\\r?\\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const headerMatch = trimmed.match(/^([SABCDE])\\s*[:\\-]\\s*(.*)$/i);
    if (headerMatch) {
      current = headerMatch[1].toUpperCase();
      const items = splitItems(headerMatch[2]);
      tiers[current].push(...items);
      return;
    }

    const soloMatch = trimmed.match(/^([SABCDE])\\s*(?:tier)?\\s*$/i);
    if (soloMatch) {
      current = soloMatch[1].toUpperCase();
      return;
    }

    if (!current) return;
    const items = splitItems(trimmed);
    if (items.length > 0) {
      tiers[current].push(...items);
    }
  });

  const deduped = {};
  Object.keys(tiers).forEach((tier) => {
    const seen = new Set();
    deduped[tier] = tiers[tier].filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  return deduped;
}

function main() {
  const args = parseArgs(process.argv);
  const input = readInput(args.input);
  const tiers = parseTierLines(input);
  const output = {
    updatedAt: new Date().toISOString().slice(0, 10),
    source: args.source || "manual",
    tiers
  };
  fs.writeFileSync(args.out, JSON.stringify(output, null, 2) + "\n");
  const total = Object.values(tiers).reduce((sum, list) => sum + list.length, 0);
  process.stdout.write(`Updated ${args.out} with ${total} champions.\\n`);
}

if (require.main === module) {
  main();
}
