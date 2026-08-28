const STATE_NAME_TO_CODE: Record<string, string> = {
  arkansas: "AR",
};

export function normalizeStateCode(state: string | undefined | null) {
  const value = state?.trim();
  if (!value) return "";
  return STATE_NAME_TO_CODE[value.toLowerCase()] ?? value.toUpperCase();
}

export function isArkansasState(state: string | undefined | null) {
  return normalizeStateCode(state) === "AR";
}
