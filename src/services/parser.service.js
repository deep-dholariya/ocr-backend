/**
 * ============================================================
 * parserService.js
 * ------------------------------------------------------------
 * Business Card OCR Parser
 *
 * Parses raw OCR text (as produced by PaddleOCR) into a
 * structured business-card object using regex + line-based
 * heuristics only — no external AI API calls.
 *
 * Supports English, Hindi (Devanagari), and Gujarati text.
 * Railway / Node.js (CommonJS) compatible.
 * ============================================================
 */

"use strict";

// ----------------------------------------------------------
// Dictionaries
// ----------------------------------------------------------

// Common job titles / designations (checked as whole-word/phrase matches).
const DESIGNATIONS = [
  "chief executive officer", "chief technology officer", "chief financial officer",
  "chief operating officer", "chief marketing officer", "managing director",
  "general manager", "deputy manager", "assistant manager", "branch manager",
  "sales manager", "marketing manager", "project manager", "product manager",
  "operations manager", "business manager", "hr manager", "account manager",
  "relationship manager", "regional manager", "area manager",
  "founder", "co-founder", "owner", "proprietor", "partner", "director",
  "vice president", "president", "chairman", "executive director",
  "software engineer", "senior software engineer", "hardware engineer",
  "civil engineer", "mechanical engineer", "electrical engineer",
  "engineer", "developer", "frontend developer", "backend developer",
  "full stack developer", "web developer", "architect", "consultant",
  "analyst", "business analyst", "designer", "graphic designer",
  "ui/ux designer", "interior designer", "accountant", "auditor",
  "advocate", "lawyer", "doctor", "physician", "surgeon", "dentist",
  "principal", "professor", "lecturer", "teacher", "administrator",
  "executive", "sales executive", "marketing executive", "hr executive",
  "team lead", "technical lead", "tech lead", "head of sales",
  "head of marketing", "head of operations", "intern", "trainee",
  "supervisor", "coordinator", "ceo", "cto", "cfo", "coo", "cio", "cmo",
  "vp", "svp", "avp", "hr", "md"
];

// Keywords used to identify a company / organization name line.
const COMPANY_KEYWORDS = [
  "pvt ltd", "pvt. ltd", "pvt. ltd.", "private limited", "limited",
  "ltd", "ltd.", "llp", "inc", "inc.", "incorporated", "corp", "corp.",
  "corporation", "technologies", "technology", "software", "systems",
  "solutions", "solution", "labs", "laboratories", "group", "consulting",
  "consultants", "digital", "media", "services", "enterprise",
  "enterprises", "infotech", "studio", "studios", "agency", "industries",
  "international", "holdings", "co.", "gmbh", "llc", "ventures",
  "traders", "trading", "exports", "imports", "associates", "co"
];

// Address-indicating keywords (kept ASCII/English; Hindi & Gujarati
// address lines are captured via the generic "remaining lines" fallback
// combined with Unicode-aware line filtering rather than a keyword list).
const ADDRESS_KEYWORDS = [
  "street", "st.", "road", "rd", "rd.", "avenue", "ave", "lane", "ln",
  "city", "state", "district", "floor", "building", "bldg", "tower",
  "complex", "sector", "block", "plot", "near", "opposite", "opp", "opp.",
  "postal", "zip", "pincode", "pin code", "pin", "india", "usa", "uk",
  "canada", "highway", "hwy", "colony", "nagar", "marg", "circle",
  "chowk", "society", "apartment", "apt", "village", "taluka", "tehsil"
];

// ----------------------------------------------------------
// Regex patterns
// ----------------------------------------------------------

// Email: standard RFC-lite pattern, case-insensitive.
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

// Phone: supports Indian (+91, 10-digit, 0-prefixed) and generic
// international formats with separators (spaces, dashes, dots, brackets).
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}(?:[-.\s]?\d{2,4})?/;

// A stricter "is this basically just a phone number" check used for
// validation once a candidate has been extracted.
const PHONE_DIGITS_ONLY_MIN = 7;
const PHONE_DIGITS_ONLY_MAX = 15;

// Website: matches domains with or without protocol/www, ignores emails.
const WEBSITE_REGEX = /\b((https?:\/\/)?(www\.)?[a-z0-9-]+\.[a-z]{2,}(\.[a-z]{2,})?(\/[^\s]*)?)\b/i;

// Indian PIN code / generic postal code.
const PIN_CODE_REGEX = /\b\d{5,6}\b/;

// Unicode ranges for Devanagari (Hindi) and Gujarati scripts, used to
// confirm multilingual lines are legitimate text (not OCR noise).
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const GUJARATI_REGEX = /[\u0A80-\u0AFF]/;

// A "name-like" line: letters (any script) with optional dots/hyphens/
// apostrophes, 1-4 words, no digits.
const NAME_LINE_REGEX = /^[\p{L}][\p{L}.'-]*(?:\s+[\p{L}][\p{L}.'-]*){0,3}$/u;

// ----------------------------------------------------------
// Low-level text utilities
// ----------------------------------------------------------

/**
 * Normalizes a single OCR line: unicode NFKC normalization,
 * whitespace cleanup, smart-quote/dash normalization, and removal
 * of stray bullet/zero-width characters. Preserves Devanagari,
 * Gujarati, and other non-Latin scripts.
 */
function cleanLine(line) {
  if (typeof line !== "string") return "";

  let out = line;

  try {
    out = out.normalize("NFKC");
  } catch (e) {
    /* normalize unsupported in this environment — continue as-is */
  }

  out = out
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "") // zero-width chars / soft hyphen
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ") // unicode spaces
    .replace(/[\u2018\u2019\u02BC]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/[\u2010-\u2015]/g, "-") // dash variants
    .replace(/[•●▪■◦‣∙|¦]/g, " ") // bullets / stray pipes
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return out;
}

/**
 * Drops lines that are almost certainly OCR noise: pure symbols,
 * or extremely low letter/digit density relative to length.
 */
function isNoiseLine(line) {
  if (!line || line.length < 2) return true;

  // Unicode-aware "is this just symbols/punctuation" check. Plain \W
  // is deliberately NOT used here: without Unicode-mode word-char
  // support it misclassifies Devanagari/Gujarati letters as "non-word"
  // and would wrongly discard legitimate multilingual lines.
  const alnum = (line.match(/[\p{L}\p{N}]/gu) || []).length;
  if (alnum === 0) return true;
  if (line.length >= 4 && alnum / line.length < 0.3) return true;

  return false;
}

/**
 * Splits raw OCR text into clean, de-duplicated, noise-free lines.
 */
function prepareLines(rawText) {
  const seen = new Set();
  const lines = [];

  rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !isNoiseLine(line))
    .forEach((line) => {
      const key = line.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      if (key && seen.has(key)) return; // drop exact/near duplicates
      if (key) seen.add(key);
      lines.push(line);
    });

  return lines;
}

// ----------------------------------------------------------
// Field-level validators
// ----------------------------------------------------------

function isValidEmail(email) {
  return typeof email === "string" && EMAIL_REGEX.test(email);
}

function isValidPhone(phone) {
  if (typeof phone !== "string") return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= PHONE_DIGITS_ONLY_MIN && digits.length <= PHONE_DIGITS_ONLY_MAX;
}

function isValidWebsite(website) {
  if (typeof website !== "string" || !website.includes(".")) return false;
  return WEBSITE_REGEX.test(website) && !website.includes("@");
}

// ----------------------------------------------------------
// Field-level normalizers
// ----------------------------------------------------------

/**
 * Normalizes a phone number into a consistent, readable format:
 * preserves a leading "+" and country code if present, strips
 * stray punctuation, and groups the remaining digits.
 */
function normalizePhone(raw) {
  if (!raw) return "";

  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (!digits) return "";

  // Indian mobile number with country code (91 + 10 digits).
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  // Plain 10-digit Indian mobile number.
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  // Generic international number — keep the "+" if it was present.
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normalizes a website URL: lowercases, strips protocol/trailing
 * slash, ensures a "www."-free canonical host+path form.
 */
function normalizeWebsite(raw) {
  if (!raw) return "";

  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function normalizeEmail(raw) {
  return raw ? raw.trim().toLowerCase() : "";
}

// ----------------------------------------------------------
// Line-level classification helpers
// ----------------------------------------------------------

function hasWordMatch(haystackLower, needleLower) {
  const escaped = needleLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u").test(haystackLower);
}

function lineHasDesignation(line) {
  const lower = line.toLowerCase();
  return DESIGNATIONS.some((title) => hasWordMatch(lower, title));
}

function lineHasCompanyKeyword(line) {
  const lower = line.toLowerCase();
  return COMPANY_KEYWORDS.some((kw) => hasWordMatch(lower, kw));
}

function lineHasAddressKeyword(line) {
  const lower = line.toLowerCase();
  if (PIN_CODE_REGEX.test(line)) return true;
  return ADDRESS_KEYWORDS.some((kw) => hasWordMatch(lower, kw));
}

function isMultilingualText(line) {
  return DEVANAGARI_REGEX.test(line) || GUJARATI_REGEX.test(line);
}

function looksLikeName(line) {
  // A name line should not contain digits, @ signs, or URL-like tokens,
  // and should match the generic multi-word "name" shape (works across
  // Latin, Devanagari, and Gujarati scripts).
  if (/\d/.test(line)) return false;
  if (line.includes("@")) return false;
  if (WEBSITE_REGEX.test(line) && line.includes(".")) return false;
  if (lineHasDesignation(line)) return false;
  if (lineHasCompanyKeyword(line)) return false;

  return NAME_LINE_REGEX.test(line) || isMultilingualText(line);
}

// ----------------------------------------------------------
// Field extraction
// ----------------------------------------------------------

/**
 * Finds the first line containing a valid email address and
 * removes it from the pool of unused lines.
 */
function extractEmail(lines, usedIndexes) {
  for (let i = 0; i < lines.length; i++) {
    if (usedIndexes.has(i)) continue;

    const match = lines[i].match(EMAIL_REGEX);
    if (match) {
      usedIndexes.add(i);
      return normalizeEmail(match[0]);
    }
  }
  return "";
}

/**
 * Finds the first line containing a valid website (that is not
 * also an email line) and removes it from the pool.
 */
function extractWebsite(lines, usedIndexes) {
  for (let i = 0; i < lines.length; i++) {
    if (usedIndexes.has(i)) continue;
    if (lines[i].includes("@")) continue;

    const match = lines[i].match(WEBSITE_REGEX);
    if (match && match[0].includes(".")) {
      usedIndexes.add(i);
      return normalizeWebsite(match[0]);
    }
  }
  return "";
}

/**
 * Finds the first line containing a plausible phone number and
 * removes it from the pool.
 */
function extractPhone(lines, usedIndexes) {
  for (let i = 0; i < lines.length; i++) {
    if (usedIndexes.has(i)) continue;

    const match = lines[i].match(PHONE_REGEX);
    if (match) {
      const digits = match[0].replace(/\D/g, "");
      if (digits.length >= PHONE_DIGITS_ONLY_MIN && digits.length <= PHONE_DIGITS_ONLY_MAX) {
        usedIndexes.add(i);
        return normalizePhone(match[0]);
      }
    }
  }
  return "";
}

/**
 * Finds the first unused line matching a known designation keyword.
 */
function extractDesignation(lines, usedIndexes) {
  for (let i = 0; i < lines.length; i++) {
    if (usedIndexes.has(i)) continue;

    if (lineHasDesignation(lines[i])) {
      usedIndexes.add(i);
      return lines[i];
    }
  }
  return "";
}

/**
 * Finds the first unused line matching a known company keyword.
 */
function extractCompany(lines, usedIndexes) {
  for (let i = 0; i < lines.length; i++) {
    if (usedIndexes.has(i)) continue;

    if (lineHasCompanyKeyword(lines[i])) {
      usedIndexes.add(i);
      return lines[i];
    }
  }
  return "";
}

/**
 * Heuristic: the first meaningful, unused, name-shaped line is
 * treated as the person's name. Falls back to the first unused
 * line overall if no line matches the strict name shape.
 */
function extractName(lines, usedIndexes) {
  for (let i = 0; i < lines.length; i++) {
    if (usedIndexes.has(i)) continue;

    if (looksLikeName(lines[i])) {
      usedIndexes.add(i);
      return lines[i];
    }
  }

  // Fallback: first remaining line that isn't clearly something else.
  for (let i = 0; i < lines.length; i++) {
    if (usedIndexes.has(i)) continue;
    if (lines[i].includes("@")) continue;
    if (PHONE_REGEX.test(lines[i]) && lines[i].replace(/\D/g, "").length >= 7) continue;

    usedIndexes.add(i);
    return lines[i];
  }

  return "";
}

/**
 * Combines all remaining unmatched lines into the address field.
 * Prioritizes lines with address keywords / PIN codes, but also
 * folds in any leftover multilingual (Hindi/Gujarati) or generic
 * text lines, since address lines are often the hardest to detect
 * by keyword alone.
 */
function extractAddress(lines, usedIndexes) {
  const parts = [];

  // Pass 1: lines that clearly look like address fragments.
  for (let i = 0; i < lines.length; i++) {
    if (usedIndexes.has(i)) continue;
    if (lineHasAddressKeyword(lines[i])) {
      parts.push(lines[i]);
      usedIndexes.add(i);
    }
  }

  // Pass 2: any remaining leftover lines (multilingual or plain text)
  // are treated as additional address context rather than discarded.
  for (let i = 0; i < lines.length; i++) {
    if (usedIndexes.has(i)) continue;
    parts.push(lines[i]);
    usedIndexes.add(i);
  }

  const unique = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  return unique.join(", ");
}

// ----------------------------------------------------------
// Confidence scoring
// ----------------------------------------------------------

/**
 * Awards points per successfully extracted & validated field.
 * Core identity fields (name, email, phone, company) weigh more
 * heavily than secondary fields (designation, website, address).
 */
function calculateConfidence(result) {
  const weights = {
    name: 20,
    email: 20,
    phone: 20,
    company: 15,
    designation: 10,
    website: 10,
    address: 5
  };

  let score = 0;

  if (result.name) score += weights.name;
  if (result.email && isValidEmail(result.email)) score += weights.email;
  if (result.phone && isValidPhone(result.phone)) score += weights.phone;
  if (result.company) score += weights.company;
  if (result.designation) score += weights.designation;
  if (result.website && isValidWebsite(result.website)) score += weights.website;
  if (result.address) score += weights.address;

  return Math.max(0, Math.min(100, score));
}

/**
 * Decides whether the result is unreliable enough to warrant a
 * fallback to AI-based parsing: true if more than two of the
 * "important" fields (name, email, phone, company) are missing.
 */
function shouldRequireAIParsing(result) {
  const importantFields = ["name", "email", "phone", "company"];
  const missingCount = importantFields.filter((field) => !result[field]).length;
  return missingCount > 2;
}

// ----------------------------------------------------------
// Public entry point
// ----------------------------------------------------------

/**
 * Parses raw PaddleOCR text into a structured business-card object.
 * Never throws — degrades gracefully to an empty-field result with
 * requiresAIParsing: true on any unexpected error.
 *
 * @param {string} rawText - raw OCR text from PaddleOCR
 * @returns {object} structured business card data
 */
function parseBusinessCard(rawText) {
  const emptyResult = {
    name: "",
    designation: "",
    company: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    confidence: 0,
    requiresAIParsing: true
  };

  try {
    if (typeof rawText !== "string" || !rawText.trim()) {
      return emptyResult;
    }

    // Guard against pathological input sizes.
    const safeText = rawText.length > 20000 ? rawText.slice(0, 20000) : rawText;

    const lines = prepareLines(safeText);
    if (!lines.length) {
      return emptyResult;
    }

    const usedIndexes = new Set();

    // Order matters: extract the most structurally unambiguous
    // fields first (email, website, phone) so they're removed from
    // the pool before the fuzzier heuristics (name, company,
    // designation, address) run over the remaining lines.
    const email = extractEmail(lines, usedIndexes);
    const website = extractWebsite(lines, usedIndexes);
    const phone = extractPhone(lines, usedIndexes);
    const designation = extractDesignation(lines, usedIndexes);
    const company = extractCompany(lines, usedIndexes);
    const name = extractName(lines, usedIndexes);
    const address = extractAddress(lines, usedIndexes);

    const result = {
      name: name.trim(),
      designation: designation.trim(),
      company: company.trim(),
      email: isValidEmail(email) ? email.trim() : "",
      phone: isValidPhone(phone) ? phone.trim() : "",
      website: isValidWebsite(website) ? website.trim() : "",
      address: address.trim()
    };

    result.confidence = calculateConfidence(result);
    result.requiresAIParsing = shouldRequireAIParsing(result);

    return result;
  } catch (err) {
    // Never let malformed OCR input crash the caller.
    return emptyResult;
  }
}

module.exports = { parseBusinessCard };
