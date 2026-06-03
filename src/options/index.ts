export type GlobalOptions = {
  current?: boolean;
  format?: string;
};

export type ListOptions = GlobalOptions & {
  validatedFormat: "text" | "json";
};

export type ShowOptions = GlobalOptions & {
  idOrName: string;
  validatedFormat: "text" | "json";
};

export type LastOptions = GlobalOptions & {
  validatedFormat: "text" | "json";
};

export type TuiOptions = {
  current?: boolean;
};

export function normalizeGlobalOptions(options: GlobalOptions): {
  current: boolean;
  format: "text" | "json";
} {
  const format = options.format ?? "text";
  if (format !== "text" && format !== "json") {
    throw new Error(`Invalid format: ${format}. Expected 'text' or 'json'.`);
  }
  return {
    current: Boolean(options.current),
    format: format as "text" | "json",
  };
}
