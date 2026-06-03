export type GlobalOptions = {
  current?: boolean;
  format?: "text" | "json";
};

export type ListOptions = GlobalOptions;

export type ShowOptions = GlobalOptions & {
  idOrName: string;
};

export type LastOptions = GlobalOptions;

export type TuiOptions = {
  current?: boolean;
};
