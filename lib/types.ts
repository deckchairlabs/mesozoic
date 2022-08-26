type Records = Record<string, string>;

export type ImportMap = {
  imports?: Records;
  scopes?: Record<string, Records>;
};
