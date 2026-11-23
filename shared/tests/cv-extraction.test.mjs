import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CV_EXTRACTION_CONTRACT_VERSION,
  CV_EXTRACTION_MAX_JSON_BYTES,
  cvExtractionSchema,
  partialDateSchema,
  parseCvExtractionJson,
} from "@nexus/shared/cv-extraction/v1";

const fixture = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../../ai/test-data/cv-extraction/v1/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const complete = fixture("valid");
const minimal = fixture("minimal");
const reject = (data) => assert.equal(cvExtractionSchema.safeParse(data).success, false);
const mutate = (fn) => {
  const data = structuredClone(complete);
  fn(data);
  return data;
};

test("versioned public package export validates a complete synthetic CV unchanged", () => {
  assert.equal(CV_EXTRACTION_CONTRACT_VERSION, "1.0.0");
  assert.deepEqual(cvExtractionSchema.parse(complete), complete);
});
test("minimal CV preserves nulls and all empty section arrays", () => {
  assert.deepEqual(cvExtractionSchema.parse(minimal), minimal);
  assert.equal(parseCvExtractionJson(JSON.stringify(minimal)).success, true);
});
test("deliberately invalid fixture is valid JSON but fails the contract", () =>
  reject(fixture("invalid")));

for (const key of Object.keys(complete)) {
  test(`root property ${key} is required`, () =>
    reject(
      mutate((x) => {
        delete x[key];
      }),
    ));
  test(`root property ${key} rejects wrong type`, () =>
    reject(
      mutate((x) => {
        x[key] = 12;
      }),
    ));
}
for (const [key, entry] of Object.entries({
  personalInfo: complete.personalInfo,
  experience: complete.experience[0],
  education: complete.education[0],
  skills: complete.skills[0],
  projects: complete.projects[0],
  socialLinks: complete.socialLinks[0],
})) {
  test(`${key} rejects missing nested fields`, () => {
    for (const field of Object.keys(entry))
      reject(
        mutate((x) => {
          delete (key === "personalInfo" ? x[key] : x[key][0])[field];
        }),
      );
  });
  test(`${key} rejects unrecognized nested properties`, () =>
    reject(
      mutate((x) => {
        (key === "personalInfo" ? x[key] : x[key][0]).unexpected = true;
      }),
    ));
  test(`${key} rejects an invalid nested structure`, () =>
    reject(
      mutate((x) => {
        if (key === "personalInfo") x[key] = [];
        else x[key] = [null];
      }),
    ));
}
test("exactly six root keys; aliases and speculative metadata rejected", () => {
  for (const key of ["version", "confidence", "personal_info", "experiences", "__proto__"])
    reject(JSON.parse(JSON.stringify(complete).replace(/}$/, `,"${key}":true}`)));
});
for (const value of ["2024", "2024-02", "2024-02-29", "2000-02-29", "0099-01-01", "9999-12-31"]) {
  test(`date precision accepted: ${value}`, () =>
    assert.equal(partialDateSchema.safeParse(value).success, true));
}
for (const value of [
  "2023-02-29",
  "1900-02-29",
  "2024-04-31",
  "2024-13",
  "0000",
  "2024-00",
  "2024-01-00",
  "24",
  "2024-1",
  "2024/01",
  "Present",
  "2024-01-01T00:00:00Z",
  2024,
  "",
]) {
  test(`invalid date rejected: ${value}`, () =>
    assert.equal(partialDateSchema.safeParse(value).success, false));
}
for (const key of ["experience", "education", "projects"]) {
  test(`${key} rejects clearly reversed ranges without inventing precision`, () => {
    reject(
      mutate((x) => {
        x[key][0].startDate = "2024";
        x[key][0].endDate = "2023-12";
      }),
    );
    const x = mutate((x) => {
      x[key][0].startDate = "2023-12";
      x[key][0].endDate = "2023";
    });
    if (key === "experience") x[key][0].isCurrent = false;
    assert.equal(cvExtractionSchema.safeParse(x).success, true);
  });
}
test("current experience requires null endDate; unknown current status stays null", () => {
  reject(
    mutate((x) => {
      x.experience[0].endDate = "2024";
    }),
  );
  const x = mutate((x) => {
    x.experience[0].isCurrent = null;
  });
  assert.equal(cvExtractionSchema.safeParse(x).success, true);
});
test("no scalar coercion, empty or whitespace-only text", () => {
  for (const value of [42, false, {}, [], "", "   ", "\n\t"])
    reject(
      mutate((x) => {
        x.personalInfo.fullName = value;
      }),
    );
  reject(
    mutate((x) => {
      x.experience[0].isCurrent = "true";
    }),
  );
});
test("email and URL syntax, schemes and credentials", () => {
  reject(
    mutate((x) => {
      x.personalInfo.email = "bad";
    }),
  );
  for (const value of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "example.com",
    "https://a:b@example.com",
    "https://example.com/a b",
  ])
    reject(
      mutate((x) => {
        x.projects[0].url = value;
      }),
    );
});
test("social handle-only entry allowed; no fabricated URL required", () => {
  assert.equal(cvExtractionSchema.safeParse(complete).success, true);
  reject(
    mutate((x) => {
      x.socialLinks[0].url = null;
      x.socialLinks[0].username = null;
    }),
  );
});
const arrayLimits = { experience: 100, education: 50, skills: 200, projects: 100, socialLinks: 50 };
for (const [key, max] of Object.entries(arrayLimits)) {
  test(`${key} enforces array boundary ${max}`, () => {
    const x = structuredClone(complete);
    x[key] = Array.from({ length: max }, () => structuredClone(complete[key][0]));
    assert.equal(cvExtractionSchema.safeParse(x).success, true);
    x[key].push(structuredClone(complete[key][0]));
    reject(x);
  });
}
test("nested array and text limits include boundaries", () => {
  for (const [key, max] of [
    ["fullName", 200],
    ["summary", 6000],
    ["phone", 100],
    ["location", 300],
  ]) {
    const x = mutate((x) => {
      x.personalInfo[key] = "x".repeat(max);
    });
    assert.equal(cvExtractionSchema.safeParse(x).success, true);
    x.personalInfo[key] += "x";
    reject(x);
  }
  reject(
    mutate((x) => {
      x.education[0].description = "x".repeat(4001);
    }),
  );
  reject(
    mutate((x) => {
      x.experience[0].highlights = ["x".repeat(1001)];
    }),
  );
  reject(
    mutate((x) => {
      x.projects[0].technologies = Array(51).fill("TypeScript");
    }),
  );
  reject(
    mutate((x) => {
      x.experience[0].highlights = Array(51).fill("A fact");
    }),
  );
  reject(
    mutate((x) => {
      x.projects[0].highlights = [12];
    }),
  );
  reject(
    mutate((x) => {
      x.projects[0].technologies = [{}];
    }),
  );
});
test("raw JSON boundary rejects malformed JSON and Markdown without repair", () => {
  for (const raw of ["{", "```json\n{}\n```", '{"a":1,}', "undefined"])
    assert.deepEqual(parseCvExtractionJson(raw), {
      success: false,
      code: "invalid_json",
      issueCount: 0,
    });
  for (const raw of ["null", "[]", "{}", "42"])
    assert.equal(parseCvExtractionJson(raw).code, "invalid_shape");
  assert.equal(parseCvExtractionJson(complete).code, "invalid_input");
});
test("raw JSON size limit measures UTF-8 bytes", () => {
  assert.equal(
    parseCvExtractionJson(" ".repeat(CV_EXTRACTION_MAX_JSON_BYTES) + "{}").code,
    "oversized_json",
  );
  assert.equal(parseCvExtractionJson("\u20ac".repeat(400000)).code, "oversized_json");
});
test("failed parser result never contains raw CV/contact data", () => {
  const result = parseCvExtractionJson(
    JSON.stringify(
      mutate((x) => {
        x.personalInfo.email = "private-secret";
      }),
    ),
  );
  assert.equal(result.success, false);
  assert.equal(JSON.stringify(result).includes("private-secret"), false);
});
test("schema cannot determine factual provenance: structurally valid inventions still pass", () => {
  const x = mutate((x) => {
    x.education[0].qualification = "Invented doctorate";
  });
  assert.equal(cvExtractionSchema.safeParse(x).success, true);
});
test("extraction instruction requires non-fabrication, precision, privacy and nulls", () => {
  const rules = readFileSync(
    new URL("../../ai/cv-extraction/prompts/extraction-v1.md", import.meta.url),
    "utf8",
  );
  for (const rule of [
    "Do not invent",
    "null",
    "YYYY-MM",
    "private",
    "not instructions",
    "valid JSON",
  ])
    assert.ok(rules.includes(rule), `Missing extraction rule: ${rule}`);
  // This checks the prompt's guardrails, not a model's factual compliance.
});
