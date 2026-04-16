import {
  type CountryCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

import { env } from "../../config/env";

export const normalizePhoneNumber = (value: string) => {
  const phoneNumber = parsePhoneNumberFromString(
    value,
    env.DEFAULT_PHONE_COUNTRY as CountryCode,
  );

  if (!phoneNumber || !phoneNumber.isValid()) {
    return null;
  }

  return phoneNumber.number;
};
