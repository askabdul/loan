const fs = require("fs");
const path = require("path");

const checks = [
  {
    file: path.resolve(__dirname, "../../admin/src/pages/ContactInfo.js"),
    forbidden: [/\/api\/admin\/contact-info/g],
  },
  {
    file: path.resolve(__dirname, "../../admin/src/pages/FAQ.js"),
    forbidden: [/\/api\/admin\/content\/faq/g],
  },
  {
    file: path.resolve(__dirname, "../../admin/src/pages/TermsConditions.js"),
    forbidden: [/\/api\/admin\/content\/terms/g],
  },
  {
    file: path.resolve(__dirname, "../../admin/src/components/RemarkDialog.js"),
    forbidden: [/\/api\/admin\/loans\/add-remark/g],
  },
  {
    file: path.resolve(__dirname, "../../cedLoan/src/services/api.js"),
    forbidden: [/\/users\/me(?!\/kyc)/g, /\/payments\/stats\b(?!\/summary)/g],
  },
  {
    file: path.resolve(__dirname, "../../cedLoan/src/services/configAPI.js"),
    forbidden: [
      /\/config\/contact-info/g,
      /\/config\/app-branding/g,
      /\/config\/loan-settings/g,
    ],
  },
];

let hasError = false;

for (const check of checks) {
  const content = fs.readFileSync(check.file, "utf8");
  for (const pattern of check.forbidden) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      hasError = true;
      console.error(
        `Contract check failed: ${check.file} contains forbidden pattern ${pattern}`,
      );
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log("Frontend endpoint contract checks passed.");
