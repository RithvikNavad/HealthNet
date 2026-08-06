const urgentRules = [
  {
    id: "breathing",
    patterns: [
      /\b(?:cannot|can't|unable to|struggling to) breathe\b/i,
      /\bsevere (?:difficulty|trouble) breathing\b/i,
    ],
  },
  {
    id: "stroke",
    patterns: [
      /\b(?:new|sudden) (?:one-sided|one sided) (?:weakness|numbness)\b/i,
      /\b(?:face|facial) droop(?:ing)?\b/i,
      /\b(?:new|sudden) slurred speech\b/i,
      /\b(?:cannot|can't|unable to) speak\b/i,
    ],
  },
  {
    id: "consciousness",
    patterns: [
      /\b(?:is|became|currently) unconscious\b/i,
      /\b(?:fainted|passed out) and (?:is )?not (?:awake|waking)\b/i,
    ],
  },
  {
    id: "allergic-reaction",
    patterns: [
      /\b(?:throat|tongue) (?:is )?swelling\b/i,
      /\bsevere allergic reaction\b/i,
      /\banaphylaxis\b/i,
    ],
  },
  {
    id: "self-harm",
    patterns: [
      /\b(?:want|plan|planning|going) to (?:kill|hurt) myself\b/i,
      /\bsuicidal (?:right now|today|with a plan)\b/i,
    ],
  },
];

const chestPainPatterns = [
  /\b(?:severe|crushing|heavy|unrelenting) chest pain\b/i,
  /\bchest pain (?:with|and) (?:shortness of breath|trouble breathing|sweating|fainting)\b/i,
];

function isNegated(text, matchIndex) {
  const prefix = text.slice(Math.max(0, matchIndex - 36), matchIndex);
  return /\b(?:no|not|without|deny|denies|denied|haven't|hasn't|didn't|do not|does not)\b[^.!?]{0,24}$/i.test(prefix);
}

function firstPositiveMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && !isNegated(text, match.index)) return match[0];
  }
  return null;
}

export function detectUrgentWarning(message) {
  const text = String(message || "").trim();
  if (!text) return null;

  const chestMatch = firstPositiveMatch(text, chestPainPatterns);
  if (chestMatch) {
    return "Severe chest pain or chest pain with other concerning symptoms may be an emergency. Call local emergency services now or go to the nearest emergency department. Do not wait to finish this intake.";
  }

  for (const rule of urgentRules) {
    if (firstPositiveMatch(text, rule.patterns)) {
      return "Some symptoms you described may require immediate help. Call local emergency services now or go to the nearest emergency department. Do not wait to finish this intake.";
    }
  }

  return null;
}
