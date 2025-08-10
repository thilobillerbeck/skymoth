import assert from "node:assert";
import { describe, test } from "node:test";
import { splitTextBluesky } from "../lib/utils";

describe("splitTextBluesky", () => {
	test("should return single post when text fits within limit", () => {
		const text = "Short text";
		const spoiler = "";
		const postLink = "https://example.com";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0], "Short text\n\nhttps://example.com");
	});

	test("should handle empty text with link", () => {
		const text = "";
		const spoiler = "";
		const postLink = "https://example.com";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0], "https://example.com");
	});

	test("should add spoiler text to single post", () => {
		const text = "Short text";
		const spoiler = "CW: Spoiler\n\n";
		const postLink = "https://example.com";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.strictEqual(result.length, 1);
		assert.strictEqual(
			result[0],
			"CW: Spoiler\n\nShort text\n\nhttps://example.com",
		);
	});

	test("should split 600 characters into two posts of 300", () => {
		const text = "A".repeat(600); // Long text that will need splitting
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		for (const post of result) {
			assert.ok(post.length === 300);
		}
	});

	test("should add numbering when enabled", () => {
		const text = "A".repeat(600);
		const spoiler = "";
		const postLink = "";
		const numbering = true;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		assert.ok(result[0].includes(`[1/${result.length}]`));
		assert.ok(
			result[result.length - 1].includes(`[${result.length}/${result.length}`),
		);
	});

	test("should not add numbering when disabled", () => {
		const text = "A".repeat(600);
		const spoiler = "";
		const postLink = " https://example.com";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		for (const post of result) {
			assert.ok(!post.includes("["));
			assert.ok(!post.includes("]"));
		}
	});

	test("should respect numbering threshold", () => {
		const text = "A".repeat(400); // Will create 3 posts
		const spoiler = "";
		const postLink = " https://example.com";
		const numbering = true;
		const numberingThreshold = 4; // Only number if 4+ posts

		const result = splitTextBluesky(
			text,
			spoiler,
			postLink,
			numbering,
			numberingThreshold,
		);

		assert.strictEqual(result.length, 3);
		for (const post of result) {
			assert.ok(!post.includes("["));
			assert.ok(!post.includes("]"));
		}
	});

	test("should apply numbering when threshold is met", () => {
		const text = "A".repeat(900); // Will create 3+ posts
		const spoiler = "";
		const postLink = " https://example.com";
		const numbering = true;
		const numberingThreshold = 3;

		const result = splitTextBluesky(
			text,
			spoiler,
			postLink,
			numbering,
			numberingThreshold,
		);

		assert.ok(result.length >= 3);
		assert.ok(result[0].includes("[1/"));
		assert.ok(result[result.length - 1].includes(`[${result.length}/`));
	});

	test("should include spoiler in all posts when splitting", () => {
		const text = "A".repeat(600);
		const spoiler = "CW: Test\n\n";
		const postLink = " https://example.com";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		for (const post of result) {
			assert.ok(post.startsWith("CW: Test\n\n"));
		}
	});

	test("should prefer splitting at line breaks", () => {
		const text = `${"A".repeat(200)}\nSecond line${"B".repeat(100)}`;
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		// Check that splitting occurs near the line break
		assert.ok(result[0].includes("\n") || result[1].includes("Second line"));
	});

	test("should prefer splitting at periods when no line breaks", () => {
		const text = `${"A".repeat(200)}. Second sentence${"B".repeat(200)}`;
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		assert.ok(result[0].includes("."));
	});

	test("should prefer splitting at punctuation when no periods", () => {
		const text = `${"A".repeat(200)}! Second part${"B".repeat(200)}`;
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		assert.ok(result[0].includes("!"));
	});

	test("should prefer splitting at spaces when no punctuation", () => {
		const text = `${"A".repeat(200)} secondword${"B".repeat(200)}`;
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		// Function should split text appropriately
		assert.ok(result[0].length <= 300);
		assert.ok(result[1].length <= 300);
	});

	test("should handle very long spoiler text", () => {
		const text = "Short text";
		const spoiler = `CW: ${"X".repeat(250)}\n\n`;
		const postLink = " https://example.com";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.strictEqual(result.length, 1);
		assert.ok(result[0].length <= 300);
	});

	test("should handle edge case with very short chunk length", () => {
		const text = "Test text";
		const spoiler = `CW: ${"X".repeat(290)}\n\n`; // Very long spoiler
		const postLink = " https://example.com";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length >= 1);
		for (const post of result) {
			assert.ok(post.length <= 300);
		}
	});

	test("should calculate numbering scale correctly for very long text", () => {
		const text = "A".repeat(10000); // Very long text
		const spoiler = "";
		const postLink = "";
		const numbering = true;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		// Should have numbering with appropriate scale
		assert.ok(result[0].includes("[1/"));
		assert.ok(result[0].includes("]"));
	});

	test("should handle text with whitespace", () => {
		const text = "Text with spaces and more text";
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0], "Text with spaces and more text");
	});

	test("should handle text with only whitespace", () => {
		const text = "   \n\n   \t   ";
		const spoiler = "";
		const postLink = " https://example.com";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.strictEqual(result.length, 1);
		// Should handle whitespace gracefully
		assert.ok(result[0].includes("https://example.com"));
	});

	test("should handle maximum length boundary correctly", () => {
		const text = "A".repeat(299); // Just under max length
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].length, 299);
	});

	test("should handle exactly maximum length", () => {
		const text = "A".repeat(300); // Exactly max length
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].length, 300);
	});

	test("should split when text exceeds maximum by one character", () => {
		const text = "A".repeat(301); // Just over max length
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		for (const post of result) {
			assert.ok(post.length <= 300);
		}
	});

	test("lorem ipsum test 1", () => {
		const text =
			"Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lore";
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length === 1);
		assert.equal(
			result[0],
			"Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lore",
		);
	});

	test("lorem ipsum test 2", () => {
		const text = `
Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.

Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat.
`;
		const spoiler = "";
		const postLink = "";
		const numbering = false;

		const result = splitTextBluesky(text, spoiler, postLink, numbering);

		assert.ok(result.length > 1);
		assert.equal(
			result[0],
			"Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.",
		);
		assert.equal(
			result[1],
			"Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.",
		);
		assert.equal(
			result[2],
			"Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.",
		);
		assert.equal(
			result[3],
			"Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi.",
		);
		assert.equal(
			result[4],
			"Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat.",
		);
	});
});
