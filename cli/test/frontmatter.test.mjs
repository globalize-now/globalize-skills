import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "../lib/frontmatter.mjs";

describe("parseFrontmatter", () => {
  it("parses simple key-value frontmatter", () => {
    const input = `---
name: lingui-setup
description: Set up LinguiJS
---

# Body content`;

    const result = parseFrontmatter(input);
    assert.equal(result.attributes.name, "lingui-setup");
    assert.equal(result.attributes.description, "Set up LinguiJS");
    assert.ok(result.body.includes("# Body content"));
  });

  it("parses multi-line folded description (>-)", () => {
    const input = `---
name: lingui-convert
description: >-
  Wrap hardcoded UI strings with LinguiJS macros and detect
  localization gaps in any React-based project.
---

Body here`;

    const result = parseFrontmatter(input);
    assert.equal(result.attributes.name, "lingui-convert");
    assert.equal(
      result.attributes.description,
      "Wrap hardcoded UI strings with LinguiJS macros and detect localization gaps in any React-based project.",
    );
  });

  it("returns empty attributes for content without frontmatter", () => {
    const input = "# Just a heading\n\nSome content";
    const result = parseFrontmatter(input);
    assert.deepEqual(result.attributes, {});
    assert.equal(result.body, input);
  });
});
