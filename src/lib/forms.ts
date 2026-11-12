import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { ApiError } from "./api";

/** Push server-side validation issues (400 with zod details) onto the matching form fields. Returns true if any were applied. */
export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  const fe = e.fieldErrors;
  let any = false;
  for (const [k, msg] of Object.entries(fe)) {
    if (k in form.getValues()) { form.setError(k as Path<T>, { type: "server", message: msg }); any = true; }
  }
  return any;
}

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
export const PASSWORD_HELP = "8 to 128 characters with a lowercase letter, an uppercase letter and a number.";
