
    /**
     * ============================================================
     * Business Card Parser Service
     * ------------------------------------------------------------
     * PART 1
     * Base structure, configuration, regex, dictionaries,
     * OCR cleanup helpers and utility methods.
     * ============================================================
     */

    class ParserService {
      constructor() {
        this.designations = new Set([
          "ceo","cto","cfo","coo","cio",
          "founder","co-founder","owner",
          "director","manager","general manager",
          "sales manager","marketing manager",
          "project manager","business manager",
          "engineer","software engineer",
          "developer","frontend developer",
          "backend developer","full stack developer",
          "designer","graphic designer",
          "consultant","analyst","architect",
          "hr","hr manager","executive",
          "sales executive","marketing executive",
          "assistant","administrator",
          "team lead","technical lead",
          "president","vice president",
          "chairman","partner","intern"
        ]);

        this.companyKeywords = [
          "pvt","private","limited","ltd","llp","inc",
          "corp","corporation","technologies",
          "technology","software","systems",
          "solutions","labs","group",
          "consulting","digital","media",
          "services","enterprise","enterprises",
          "infotech","studio","agency"
        ];

        this.addressKeywords = [
          "street","st","road","rd","avenue","ave",
          "lane","ln","city","state","district",
          "floor","building","tower","complex",
          "sector","block","plot","near",
          "opposite","opp","postal","zip","postcode",
          "india","usa","uk","canada"
        ];

        this.emailRegex =
          /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

        this.websiteRegex =
          /\b((https?:\/\/)?(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/[^\s]*)?)\b/i;

        this.phoneRegex =
          /(\+?\d[\d\s().-]{6,}\d)/;

        this.zipRegex =
          /\b\d{5,6}\b/;

        this.nameRegex =
          /^[A-Za-z.'-]+(?:\s+[A-Za-z.'-]+){0,2}$/;

      }

      parseBusinessCard(rawText = "") {
        if (!rawText || typeof rawText !== "string") {
          return {};
        }

        const lines = this.prepareLines(rawText);

        if (!lines.length) {
          return {};
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


    // -----------------------------
    // Used line tracking
    // -----------------------------

    const usedIndexes = new Set();

    // -----------------------------
    // Email
    // -----------------------------

    for (let i = 0; i < lines.length; i++) {
      if (this.isEmail(lines[i])) {
        const match = lines[i].match(this.emailRegex);

        if (match) {
          result.email = match[0].toLowerCase();
          usedIndexes.add(i);
          break;
        }
      }
    }

    // -----------------------------
    // Website
    // -----------------------------

    for (let i = 0; i < lines.length; i++) {
      if (usedIndexes.has(i)) continue;

      if (this.isWebsite(lines[i])) {
        const match = lines[i].match(this.websiteRegex);

        if (match) {
          result.website = match[0]
            .replace(/^https?:\/\//i, "")
            .replace(/\/$/, "");

          usedIndexes.add(i);
          break;
        }
      }
    }

    // -----------------------------
    // Phone Extraction
    // -----------------------------

    const phoneLines = [];

    for (let i = 0; i < lines.length; i++) {
      if (usedIndexes.has(i)) continue;

      const line = lines[i];

      if (
        this.isPhone(line) ||
        /^\+\d{1,4}$/.test(line) ||
        /^\d{2,}$/.test(line)
      ) {
        phoneLines.push({
          index: i,
          text: line
        });
      }
    }

    if (phoneLines.length) {
      const merged = [];

      for (let i = 0; i < phoneLines.length; i++) {
        const current = phoneLines[i];

        if (/^\+\d{1,4}$/.test(current.text)) {
          if (phoneLines[i + 1]) {
            merged.push(
              current.text + " " + phoneLines[i + 1].text
            );

            usedIndexes.add(current.index);
            usedIndexes.add(phoneLines[i + 1].index);

            i++;
            continue;
          }
        }

        merged.push(current.text);
        usedIndexes.add(current.index);
      }

      result.phone = this.unique(merged).join(" ");
    }

    // -----------------------------
    // Remaining Lines
    // -----------------------------

    const remainingLines = [];

    for (let i = 0; i < lines.length; i++) {
      if (!usedIndexes.has(i)) {
        remainingLines.push({
          index: i,
          text: lines[i]
        });
      }
    }


    // -----------------------------
    // Designation Extraction
    // -----------------------------

    for (const item of remainingLines) {
      if (this.isDesignation(item.text)) {
        result.designation = item.text;
        usedIndexes.add(item.index);
        break;
      }
    }

    // -----------------------------
    // Address Extraction
    // -----------------------------

    const addressParts = [];

    for (let i = 0; i < lines.length; i++) {
      if (usedIndexes.has(i)) continue;

      const line = lines[i];

      if (this.isAddress(line)) {
        addressParts.push(line);
        usedIndexes.add(i);

        let j = i + 1;

        while (
          j < lines.length &&
          !usedIndexes.has(j) &&
          !this.isEmail(lines[j]) &&
          !this.isWebsite(lines[j]) &&
          !this.isPhone(lines[j]) &&
          !this.isDesignation(lines[j])
        ) {
          if (
            /^[A-Za-z0-9,.\- ]+$/.test(lines[j]) &&
            lines[j].length > 2
          ) {
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

    // -----------------------------
    // Refresh Remaining Lines
    // -----------------------------

    const finalRemaining = [];

    for (let i = 0; i < lines.length; i++) {
      if (!usedIndexes.has(i)) {
        finalRemaining.push({
          index: i,
          text: lines[i]
        });
      }
    }

    // -----------------------------
    // Name Detection
    // -----------------------------

    const nameCandidates = [];

    for (const item of finalRemaining) {
      if (this.isPossibleName(item.text)) {
        nameCandidates.push(item.text);
      }
    }

    if (nameCandidates.length >= 2) {
      result.name = `${nameCandidates[1]} ${nameCandidates[0]}`;
    } else if (nameCandidates.length === 1) {
      result.name = nameCandidates[0];
    }

    // -----------------------------
    // Company Detection
    // -----------------------------

    const companyCandidates = [];

    for (const item of finalRemaining) {
      const value = item.text;

      if (!value) continue;
      if (value === result.name) continue;
      if (value === result.designation) continue;

      if (this.isCompany(value)) {
        companyCandidates.push(value);
        continue;
      }

      if (
        value.length > 3 &&
        !this.isEmail(value) &&
        !this.isWebsite(value) &&
        !this.isPhone(value) &&
        !this.isAddress(value)
      ) {
        companyCandidates.push(value);
      }
    }

    if (companyCandidates.length) {
      result.company = companyCandidates[companyCandidates.length - 1];
    }

    // -----------------------------
    // Cleanup
    // -----------------------------

    Object.keys(result).forEach((key) => {
      if (typeof result[key] === "string") {
        result[key] = result[key].trim().replace(/\s+/g, " ");
      }

      if (!result[key]) {
        delete result[key];
      }
    });

    // Remove company if identical to person's name
    if (
      result.company &&
      result.name &&
      result.company.toLowerCase() === result.name.toLowerCase()
    ) {
      delete result.company;
    }

    // Remove designation if duplicated in company
    if (
      result.designation &&
      result.company &&
      result.company
        .toLowerCase()
        .includes(result.designation.toLowerCase())
    ) {
      delete result.designation;
    }

    // -----------------------------
    // Return
    // -----------------------------

    return result;
      }

      prepareLines(text) {
        return text
          .split(/\r?\n/)
          .map((line) => this.cleanLine(line))
          .filter(Boolean)
          .filter((line) => line.length > 1);
      }

      cleanLine(line = "") {
        return line
          .replace(/[|]/g, "I")
          .replace(/[•●▪■]/g, "")
          .replace(/\t/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }

      normalize(text = "") {
        return text.toLowerCase().trim();
      }

      isEmail(text) {
        return this.emailRegex.test(text);
      }

      isWebsite(text) {
        return !text.includes("@") && this.websiteRegex.test(text);
      }

      isPhone(text) {
        return this.phoneRegex.test(text);
      }

      isDesignation(text) {
        const value = this.normalize(text);

        for (const item of this.designations) {
          if (value.includes(item)) return true;
        }

        return false;
      }

      isCompany(text) {
        const value = this.normalize(text);
        return this.companyKeywords.some(k => value.includes(k));
      }

      isAddress(text) {
        const value = this.normalize(text);

        if (this.zipRegex.test(value)) return true;

        return this.addressKeywords.some(k => value.includes(k));
      }

      isPossibleName(text) {
        if (!this.nameRegex.test(text)) return false;
        if (this.isEmail(text)) return false;
        if (this.isWebsite(text)) return false;
        if (this.isPhone(text)) return false;
        if (this.isDesignation(text)) return false;
        if (this.isCompany(text)) return false;

        return true;
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
    }

    export default new ParserService();
