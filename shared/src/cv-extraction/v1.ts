import { z } from "zod";

// Version belongs to the selected contract, never to Gemini's six-field payload.
export const CV_EXTRACTION_CONTRACT_VERSION = "1.0.0" as const;
export const CV_EXTRACTION_MAX_JSON_BYTES = 1_048_576;

const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value.trim().length > 0, {
      message: "Use null for unknown text, not whitespace",
    });
const shortText = text(200);
const description = text(4000).nullable();
const highlights = z.array(text(1000)).max(50);

function validPartialDate(value: string): boolean {
  if (!/^(?!0000)\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (day === undefined) return true;
  if (year === undefined || month === undefined) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (days[month - 1] ?? 0);
}

/** Calendar-valid YYYY, YYYY-MM, or YYYY-MM-DD, with no inferred components. */
export const partialDateSchema = z.string().max(10).refine(validPartialDate, {
  message: "Expected a real calendar date at year, month, or day precision",
});
const date = partialDateSchema.nullable();
function orderedDates(entry: { startDate: string | null; endDate: string | null }): boolean {
  if (entry.startDate === null || entry.endDate === null) return true;
  // Compare precision intervals, not invented dates. Overlapping intervals are valid.
  const startLower = entry.startDate.padEnd(10, "-01");
  const endUpper =
    entry.endDate.length === 4
      ? `${entry.endDate}-12-31`
      : entry.endDate.length === 7
        ? `${entry.endDate}-31`
        : entry.endDate;
  return startLower <= endUpper;
}
const webUrl = text(2048).refine(
  (value) => {
    if (value.trim() !== value || /\s/.test(value)) return false;
    try {
      const url = new URL(value);
      return (
        /^https?:\/\//i.test(value) &&
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.hostname.length > 0 &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  },
  { message: "Expected an absolute HTTP(S) URL without credentials or whitespace" },
);

export const personalInfoSchema = z.strictObject({
  fullName: shortText.nullable(),
  headline: shortText.nullable(),
  summary: text(6000).nullable(),
  email: z.email().max(254).nullable(),
  phone: text(100).nullable(),
  location: text(300).nullable(),
  website: webUrl.nullable(),
});

export const experienceSchema = z
  .strictObject({
    company: shortText.nullable(),
    role: shortText.nullable(),
    location: text(300).nullable(),
    startDate: date,
    endDate: date,
    isCurrent: z.boolean().nullable(),
    description,
    highlights,
  })
  .refine(orderedDates, { message: "End precedes start", path: ["endDate"] })
  .refine((entry) => entry.isCurrent !== true || entry.endDate === null, {
    message: "Current experience must not have an end date",
    path: ["endDate"],
  });

export const educationSchema = z
  .strictObject({
    institution: shortText.nullable(),
    qualification: shortText.nullable(),
    fieldOfStudy: shortText.nullable(),
    startDate: date,
    endDate: date,
    description,
  })
  .refine(orderedDates, { message: "End precedes start", path: ["endDate"] });

export const skillSchema = z.strictObject({
  name: shortText,
  category: shortText.nullable(),
  proficiency: text(100).nullable(),
});

export const projectSchema = z
  .strictObject({
    name: shortText.nullable(),
    description,
    url: webUrl.nullable(),
    startDate: date,
    endDate: date,
    technologies: z.array(shortText).max(50),
    highlights,
  })
  .refine(orderedDates, { message: "End precedes start", path: ["endDate"] });

export const socialLinkSchema = z
  .strictObject({
    platform: shortText.nullable(),
    url: webUrl.nullable(),
    username: shortText.nullable(),
  })
  .refine((entry) => entry.url !== null || entry.username !== null, {
    message: "A social entry requires a source URL or username",
  });

/** Private extraction DTO. Not a database row or approved public portfolio. */
export const cvExtractionSchema = z.strictObject({
  personalInfo: personalInfoSchema,
  experience: z.array(experienceSchema).max(100),
  education: z.array(educationSchema).max(50),
  skills: z.array(skillSchema).max(200),
  projects: z.array(projectSchema).max(100),
  socialLinks: z.array(socialLinkSchema).max(50),
});

export type CvExtraction = z.infer<typeof cvExtractionSchema>;
export type PersonalInfo = z.infer<typeof personalInfoSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Project = z.infer<typeof projectSchema>;
export type SocialLink = z.infer<typeof socialLinkSchema>;
export type PartialDate = z.infer<typeof partialDateSchema>;

export type CvExtractionJsonResult =
  | { success: true; data: CvExtraction }
  | {
      success: false;
      code: "invalid_input" | "oversized_json" | "invalid_json" | "invalid_shape";
      issueCount: number;
    };

/** Parse model text without coercion, Markdown stripping, repair, or raw-data errors. */
export function parseCvExtractionJson(raw: unknown): CvExtractionJsonResult {
  if (typeof raw !== "string") return { success: false, code: "invalid_input", issueCount: 0 };
  if (
    raw.length > CV_EXTRACTION_MAX_JSON_BYTES ||
    new TextEncoder().encode(raw).byteLength > CV_EXTRACTION_MAX_JSON_BYTES
  ) {
    return { success: false, code: "oversized_json", issueCount: 0 };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { success: false, code: "invalid_json", issueCount: 0 };
  }
  const result = cvExtractionSchema.safeParse(value);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, code: "invalid_shape", issueCount: result.error.issues.length };
}
