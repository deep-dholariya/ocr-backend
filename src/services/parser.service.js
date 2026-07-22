/**
 * ============================================================
 * Business Card Parser Service
 * ------------------------------------------------------------
 * PART 1
 * Base structure, configuration, regex, dictionaries.
 *
 * This service turns raw OCR text (as produced by any OCR
 * engine — Tesseract, cloud vision APIs, mobile scanners,
 * etc.) into structured business-card fields:
 *   { name, company, designation, email, phone, website, address }
 *
 * It is designed to be resilient to the kinds of noise real
 * OCR engines introduce: character confusables (O/0, l/1/I,
 * S/5, B/8), stray symbols, broken/duplicated lines, smart
 * quotes, full-width characters, zero-width spaces, and
 * multilingual/accented text.
 * ============================================================
 */

class ParserService {
  constructor() {
    // ----------------------------------------------------------
    // Dictionaries
    // ----------------------------------------------------------
    this.designations = new Set([
      "ceo", "cto", "cfo", "coo", "cio",
      "founder", "co-founder", "owner",
      "director", "manager", "general manager",
      "sales manager", "marketing manager",
      "project manager", "business manager",
      "engineer", "software engineer",
      "developer", "frontend developer",
      "backend developer", "full stack developer",
      "designer", "graphic designer",
      "consultant", "analyst", "architect",
      "hr", "hr manager", "executive",
      "sales executive", "marketing executive",
      "assistant", "administrator",
      "team lead", "technical lead",
      "president", "vice president",
      "chairman", "partner", "intern",
      // additional common/multilingual variants
      "managing director", "deputy manager", "asst manager",
      "proprietor", "principal", "head of sales",
      "head of marketing", "vp", "svp", "avp"
    ]);

    this.honorifics = new Set([
      "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "miss",
      "dr", "dr.", "prof", "prof.", "er", "er.", "eng", "eng."
    ]);

    this.companyKeywords = [
      "pvt", "private", "limited", "ltd", "llp", "inc",
      "corp", "corporation", "technologies",
      "technology", "software", "systems",
      "solutions", "labs", "group",
      "consulting", "digital", "media",
      "services", "enterprise", "enterprises",
      "infotech", "studio", "agency",
      "industries", "international", "holdings",
      "co", "co.", "gmbh", "llc", "gmbh."
    ];

    this.addressKeywords = [
      "street", "st", "road", "rd", "avenue", "ave",
      "lane", "ln", "city", "state", "district",
      "floor", "building", "tower", "complex",
      "sector", "block", "plot", "near",
      "opposite", "opp", "postal", "zip", "postcode",
      "india", "usa", "uk", "canada",
      "highway", "hwy", "colony", "nagar", "marg",
      "circle", "chowk", "society", "apartment", "apt"
    ];

    // ----------------------------------------------------------
    // Regex — kept permissive on purpose; OCR text is messy and
    // over-strict patterns silently drop valid matches.
    // ----------------------------------------------------------
    this.emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

    this.websiteRegex =
      /\b((https?:\/\/)?(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/[^\s]*)?)\b/i;

    this.phoneRegex = /(\+?\d[\d\s().-]{6,}\d)/;

    this.zipRegex = /\b\d{5,6}\b/;
    // Broader postal code pattern for non-numeric formats (e.g. UK: SW1A 1AA)
    this.altPostalRegex = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i;

    // Unicode-aware name pattern: supports accented Latin, Cyrillic,
    // Greek, Devanagari, etc. Falls back gracefully where the `u`
    // flag / \p{L} isn't supported (older engines) via a try/catch
    // during construction.
    this.nameRegex = this._buildNameRegex();

    // ----------------------------------------------------------
    // OCR confusable-character maps, used contextually (never
    // applied blindly to free text, only to fields we've already
    // classified as numeric/email/website-like).
    // ----------------------------------------------------------
    this.digitConfusables = {
      O: "0", o: "0", D: "0",
      I: "1", l: "1", i: "1", "|": "1",
      Z: "2", z: "2",
      S: "5", s: "5",
      B: "8",
      G: "6",
      T: "7",
      g: "9", q: "9"
    };

    this.wordConfusables = [
      [/\bvvww\b/gi, "www"],
      [/\bwvvw\b/gi, "www"],
      [/\bwww\.?,/gi, "www."],
      [/\bgmai1\b/gi, "gmail"],
      [/\bgmall\b/gi, "gmail"],
      [/\bhotma1l\b/gi, "hotmail"],
      [/\byaho0\b/gi, "yahoo"]
    ];
  }

  // ==============================================================
  // PART 2 — Public entry point
  // ==============================================================

  /**
   * Parse raw OCR text into structured business-card fields.
   * @param {string} rawText - raw text from an OCR engine
   * @param {object} [options]
   * @param {boolean} [options.debug=false] - include a `_debug` block
   *        with warnings and intermediate line classification.
   * @returns {object} structured result (never throws)
   */
  parseBusinessCard(rawText = "", options = {}) {
    const debug = !!options.debug;
    const warnings = [];

    try {
      if (typeof rawText !== "string" || !rawText.trim()) {
        return debug ? { _debug: { warnings: ["empty or invalid input"] } } : {};
      }

      // Guard against pathological input sizes (e.g. corrupted OCR dumps)
      const safeText = rawText.length > 20000
        ? rawText.slice(0, 20000)
        : rawText;

      const lines = this.prepareLines(safeText);

      if (!lines.length) {
        return debug ? { _debug: { warnings: ["no usable lines after cleanup"] } } : {};
      }

      const result = {
        name: "",
        company: "",
        designation: "",
        email: "",
        phone: "",
        website: "",
        address: ""
      };

      const usedIndexes = new Set();

      // Pre-classify every line once; every subsequent step reads
      // from this cache instead of re-running regexes repeatedly.
      const classified = lines.map((line) => this.classifyLine(line));

      this.extractEmail(lines, classified, usedIndexes, result, warnings);
      this.extractWebsite(lines, classified, usedIndexes, result, warnings);
      this.extractPhone(lines, classified, usedIndexes, result, warnings);
      this.extractDesignation(lines, classified, usedIndexes, result);
      this.extractAddress(lines, classified, usedIndexes, result);
      this.extractNameAndCompany(lines, classified, usedIndexes, result);

      this.finalizeResult(result);

      if (debug) {
        result._debug = {
          warnings,
          lines,
          classified
        };
      }

      return result;
    } catch (err) {
      // Never let a malformed card crash the caller — degrade gracefully.
      warnings.push(`parse error: ${err && err.message ? err.message : String(err)}`);
      return debug ? { _debug: { warnings } } : {};
    }
  }

  // ==============================================================
  // PART 3 — Line preprocessing / OCR cleanup
  // ==============================================================

  prepareLines(text) {
    const rawLines = text
      .split(/\r?\n/)
      .map((line) => this.cleanLine(line))
      .filter(Boolean)
      .filter((line) => line.length > 1)
      .filter((line) => !this.isNoiseLine(line));

    return this.mergeBrokenLines(this.dedupeLines(rawLines));
  }

  /**
   * Normalizes a single raw OCR line: unicode normalization,
   * whitespace/quote/dash cleanup, ligature expansion, and
   * removal of stray OCR artifacts — without touching legitimate
   * accented or non-Latin characters (needed for multilingual
   * names/addresses).
   */
  cleanLine(line = "") {
    if (typeof line !== "string") return "";

    let out = line;

    // Normalize compatibility characters (full-width digits/letters,
    // ligatures like "ﬁ" -> "fi", etc.) into standard form.
    try {
      out = out.normalize("NFKC");
    } catch (e) {
      /* normalize unsupported — continue with raw string */
    }

    out = out
      // strip zero-width spaces / BOM / soft hyphen
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
      // normalize non-breaking / unusual spaces to a regular space
      .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
      // normalize smart quotes to plain ones
      .replace(/[\u2018\u2019\u02BC]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // normalize dash variants to a plain hyphen
      .replace(/[\u2010-\u2015]/g, "-")
      // common OCR glyph swaps
      .replace(/[|¦]/g, "I")
      .replace(/[•●▪■◦‣∙]/g, "")
      .replace(/\t/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // fix common whole-word OCR misreads (www/gmail/etc.)
    for (const [pattern, replacement] of this.wordConfusables) {
      out = out.replace(pattern, replacement);
    }

    return out;
  }

  /**
   * Drops lines that are almost certainly OCR noise: pure symbol
   * runs, single stray characters, or extremely low
   * alphanumeric-to-length ratio.
   */
  isNoiseLine(line) {
    if (!line) return true;
    if (/^[\W_]+$/.test(line)) return true;

    const alnum = (line.match(/[\p{L}\p{N}]/gu) || []).length;
    if (alnum === 0) return true;
    if (line.length >= 4 && alnum / line.length < 0.25) return true;

    return false;
  }

  /**
   * Removes exact and near-duplicate lines. OCR engines frequently
   * emit the same line twice (once per detection pass/column) —
   * left unchecked this corrupts name/address joins downstream.
   */
  dedupeLines(lines) {
    const seen = new Set();
    const out = [];

    for (const line of lines) {
      const key = this.normalize(line).replace(/[^\p{L}\p{N}]/gu, "");
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      out.push(line);
    }

    return out;
  }

  /**
   * Rejoins lines that OCR likely split mid-token — e.g. an email
   * or website broken across two lines, or a line ending mid-word
   * with a hyphen.
   */
  mergeBrokenLines(lines) {
    const merged = [];

    for (let i = 0; i < lines.length; i++) {
      const current = lines[i];
      const next = lines[i + 1];

      const endsWithHyphen = /[a-zA-Z]-$/.test(current);
      const endsWithAt = /@\s*$/.test(current);
      const endsWithDot = /\.\s*$/.test(current) && this.websiteRegex.test(current + "x");

      if (next && (endsWithHyphen || endsWithAt)) {
        const joined = endsWithHyphen
          ? current.replace(/-$/, "") + next
          : current.replace(/\s+$/, "") + next.replace(/^\s+/, "");

        merged.push(this.cleanLine(joined));
        i++; // consume next line
        continue;
      }

      merged.push(current);
    }

    return merged;
  }

  normalize(text = "") {
    return text.toLocaleLowerCase().trim();
  }

  // ==============================================================
  // PART 4 — Line classification (single pass, cached)
  // ==============================================================

  /**
   * Computes and caches every relevant boolean flag for a line so
   * downstream extraction steps never re-run the same regex twice.
   */
  classifyLine(line) {
    return {
      text: line,
      isEmail: this.isEmail(line),
      isWebsite: this.isWebsite(line),
      isPhone: this.isPhone(line),
      isDesignation: this.isDesignation(line),
      isCompany: this.isCompany(line),
      isAddress: this.isAddress(line),
      isPossibleName: this.isPossibleName(line)
    };
  }

  isEmail(text) {
    return this.emailRegex.test(this.normalizeEmailCandidate(text));
  }

  isWebsite(text) {
    if (!text || text.includes("@")) return false;
    return this.websiteRegex.test(text);
  }

  isPhone(text) {
    return this.phoneRegex.test(text);
  }

  isDesignation(text) {
    const value = this.normalize(this.stripHonorific(text));

    if (this.designations.has(value)) return true;

    for (const item of this.designations) {
      if (value.includes(item)) return true;
    }

    // fuzzy fallback for minor OCR misreads (e.g. "Manoger")
    for (const item of this.designations) {
      if (Math.abs(value.length - item.length) <= 2 &&
          this.levenshtein(value, item) <= this.fuzzyThreshold(item)) {
        return true;
      }
    }

    return false;
  }

  isCompany(text) {
    const value = this.normalize(text);
    return this.companyKeywords.some((k) => this.hasWord(value, k));
  }

  isAddress(text) {
    const value = this.normalize(text);

    if (this.zipRegex.test(value)) return true;
    if (this.altPostalRegex.test(text)) return true;

    return this.addressKeywords.some((k) => this.hasWord(value, k));
  }

  isPossibleName(text) {
    const stripped = this.stripHonorific(text);

    if (!this.nameRegex.test(stripped)) return false;
    if (this.isEmail(text)) return false;
    if (this.isWebsite(text)) return false;
    if (this.isPhone(text)) return false;
    if (this.isDesignation(text)) return false;
    if (this.isCompany(text)) return false;

    return true;
  }

  // ==============================================================
  // PART 5 — Field extraction
  // ==============================================================

  extractEmail(lines, classified, usedIndexes, result, warnings) {
    for (let i = 0; i < lines.length; i++) {
      if (classified[i].isEmail) {
        const candidate = this.normalizeEmailCandidate(lines[i]);
        const match = candidate.match(this.emailRegex);

        if (match) {
          result.email = match[0].toLowerCase();
          usedIndexes.add(i);
          return;
        }
      }
    }
    warnings.push("no email found");
  }

  /**
   * Cleans up common OCR email noise: spaces around @ and .,
   * " at "/" dot " spelled out, trailing punctuation.
   */
  normalizeEmailCandidate(text = "") {
    return text
      .replace(/\s*@\s*/g, "@")
      .replace(/\s+at\s+/gi, "@")
      .replace(/\s+dot\s+/gi, ".")
      .replace(/\s*\.\s*/g, ".")
      .replace(/[,;]+$/, "");
  }

  extractWebsite(lines, classified, usedIndexes, result, warnings) {
    for (let i = 0; i < lines.length; i++) {
      if (usedIndexes.has(i)) continue;

      if (classified[i].isWebsite) {
        const candidate = lines[i].replace(/\s+/g, "");
        const match = candidate.match(this.websiteRegex);

        if (match) {
          result.website = match[0]
            .replace(/^https?:\/\//i, "")
            .replace(/\/$/, "")
            .toLowerCase();

          usedIndexes.add(i);
          return;
        }
      }
    }
    warnings.push("no website found");
  }

  extractPhone(lines, classified, usedIndexes, result, warnings) {
    const phoneLines = [];

    for (let i = 0; i < lines.length; i++) {
      if (usedIndexes.has(i)) continue;

      const line = lines[i];
      const digitized = this.digitizeIfPhoneLike(line);

      if (
        classified[i].isPhone ||
        /^\+\d{1,4}$/.test(digitized) ||
        /^\d{2,}$/.test(digitized)
      ) {
        phoneLines.push({ index: i, text: digitized });
      }
    }

    if (!phoneLines.length) {
      warnings.push("no phone found");
      return;
    }

    const merged = [];

    for (let i = 0; i < phoneLines.length; i++) {
      const current = phoneLines[i];

      if (/^\+\d{1,4}$/.test(current.text) && phoneLines[i + 1]) {
        merged.push(current.text + " " + phoneLines[i + 1].text);
        usedIndexes.add(current.index);
        usedIndexes.add(phoneLines[i + 1].index);
        i++;
        continue;
      }

      merged.push(current.text);
      usedIndexes.add(current.index);
    }

    const validated = merged.filter((p) => this.isPlausiblePhone(p));
    result.phone = this.unique(validated.length ? validated : merged).join(" ");
  }

  /**
   * Converts letter confusables to digits only when the line is
   * mostly numeric/phone punctuation already — avoids corrupting
   * genuine alphabetic text.
   */
  digitizeIfPhoneLike(line) {
    const strippedPunct = line.replace(/[\s+().-]/g, "");
    if (!strippedPunct.length) return line;

    const digitLikeCount = strippedPunct
      .split("")
      .filter((ch) => /\d/.test(ch) || this.digitConfusables[ch] !== undefined)
      .length;

    if (digitLikeCount / strippedPunct.length < 0.7) return line;

    return line
      .split("")
      .map((ch) => this.digitConfusables[ch] ?? ch)
      .join("");
  }

  isPlausiblePhone(text) {
    const digits = text.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }

  extractDesignation(lines, classified, usedIndexes, result) {
    for (let i = 0; i < lines.length; i++) {
      if (usedIndexes.has(i)) continue;

      if (classified[i].isDesignation) {
        result.designation = lines[i];
        usedIndexes.add(i);
        return;
      }
    }
  }

  extractAddress(lines, classified, usedIndexes, result) {
    const addressParts = [];

    for (let i = 0; i < lines.length; i++) {
      if (usedIndexes.has(i)) continue;

      if (classified[i].isAddress) {
        addressParts.push(lines[i]);
        usedIndexes.add(i);

        let j = i + 1;

        while (
          j < lines.length &&
          !usedIndexes.has(j) &&
          !classified[j].isEmail &&
          !classified[j].isWebsite &&
          !classified[j].isPhone &&
          !classified[j].isDesignation
        ) {
          if (/^[\p{L}\p{N},.\- ]+$/u.test(lines[j]) && lines[j].length > 2) {
            addressParts.push(lines[j]);
            usedIndexes.add(j);
            j++;
          } else {
            break;
          }
        }

        break;
      }
    }

    if (addressParts.length) {
      result.address = this.unique(addressParts).join(", ");
    }
  }

  extractNameAndCompany(lines, classified, usedIndexes, result) {
    const remaining = [];

    for (let i = 0; i < lines.length; i++) {
      if (!usedIndexes.has(i)) {
        remaining.push({ index: i, text: lines[i], meta: classified[i] });
      }
    }

    // ---- Name ----
    const nameCandidates = [];

    for (const item of remaining) {
      if (item.meta.isPossibleName) {
        nameCandidates.push(this.stripHonorific(item.text));
      }
    }

    if (nameCandidates.length >= 2) {
      result.name = `${nameCandidates[1]} ${nameCandidates[0]}`;
    } else if (nameCandidates.length === 1) {
      result.name = nameCandidates[0];
    }

    // ---- Company ----
    const companyCandidates = [];

    for (const item of remaining) {
      const value = item.text;

      if (!value) continue;
      if (value === result.name) continue;
      if (value === result.designation) continue;

      if (item.meta.isCompany) {
        companyCandidates.push(value);
        continue;
      }

      if (
        value.length > 3 &&
        !item.meta.isEmail &&
        !item.meta.isWebsite &&
        !item.meta.isPhone &&
        !item.meta.isAddress
      ) {
        companyCandidates.push(value);
      }
    }

    if (companyCandidates.length) {
      result.company = companyCandidates[companyCandidates.length - 1];
    }
  }

  // ==============================================================
  // PART 6 — Finalization / cleanup
  // ==============================================================

  finalizeResult(result) {
    Object.keys(result).forEach((key) => {
      if (typeof result[key] === "string") {
        result[key] = result[key].trim().replace(/\s+/g, " ");
      }
      if (!result[key]) {
        delete result[key];
      }
    });

    if (
      result.company &&
      result.name &&
      result.company.toLowerCase() === result.name.toLowerCase()
    ) {
      delete result.company;
    }

    if (
      result.designation &&
      result.company &&
      result.company.toLowerCase().includes(result.designation.toLowerCase())
    ) {
      delete result.designation;
    }

    return result;
  }

  // ==============================================================
  // PART 7 — Utilities
  // ==============================================================

  stripHonorific(text = "") {
    const parts = text.split(" ");
    if (parts.length > 1 && this.honorifics.has(this.normalize(parts[0]).replace(/\.$/, "") + ".")) {
      return parts.slice(1).join(" ");
    }
    if (parts.length > 1 && this.honorifics.has(this.normalize(parts[0]))) {
      return parts.slice(1).join(" ");
    }
    return text;
  }

  hasWord(haystack, needle) {
    // word-boundary aware "includes" — avoids "hr" matching inside "another"
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u").test(haystack);
  }

  fuzzyThreshold(word) {
    if (word.length <= 4) return 0;
    if (word.length <= 8) return 1;
    return 2;
  }

  /** Standard iterative Levenshtein edit distance. */
  levenshtein(a = "", b = "") {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
      const curr = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + cost
        );
      }
      prev = curr;
    }

    return prev[b.length];
  }

  unique(values = []) {
    return [...new Set(values)];
  }

  compact(values = []) {
    return values.filter(Boolean);
  }

  join(values = [], separator = " ") {
    return this.compact(values).join(separator).trim();
  }

  /**
   * Builds the Unicode-aware name regex, falling back to a
   * Latin-only pattern on environments without \p{L} support.
   */
  _buildNameRegex() {
    try {
      return new RegExp("^\\p{L}[\\p{L}.'-]*(?:\\s+\\p{L}[\\p{L}.'-]*){0,2}$", "u");
    } catch (e) {
      return /^[A-Za-z.'-]+(?:\s+[A-Za-z.'-]+){0,2}$/;
    }
  }
}

export default new ParserService();
