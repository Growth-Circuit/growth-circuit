import { readdir, readFile } from "node:fs/promises";
import { memberIdFromFilename, memberProfileSchema } from "../src/lib/member-schema.ts";

const directory = new URL("../src/content/members/", import.meta.url);
const filenames = (await readdir(directory)).filter((name) => name.endsWith(".json"));
let failed = false;
for (const filename of filenames) {
  try {
    memberIdFromFilename(filename, JSON.parse(await readFile(new URL(filename, directory), "utf8")));
  } catch (error) {
    failed = true;
    console.error(`${filename}: ${error.message}`);
  }
}
try {
  memberProfileSchema.parse(JSON.parse(await readFile(new URL("../examples/member-profile.json", import.meta.url), "utf8")));
} catch (error) {
  failed = true;
  console.error(`examples/member-profile.json: ${error.message}`);
}
if (failed) process.exitCode = 1;
else console.log(`Validated ${filenames.length} member profile(s) and the example template.`);
